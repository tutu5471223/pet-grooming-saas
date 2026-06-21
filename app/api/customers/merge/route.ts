// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-guard"
import { readJson, z } from "@/lib/validation"

const mergeSchema = z.object({
  primaryId: z.string().trim().min(1),
  secondaryId: z.string().trim().min(1),
})

export async function POST(req: NextRequest) {
  // OWNER-only: merging customers reassigns money/points/history.
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response

  const { shopId, userId } = guard.ctx

  const parsed = await readJson(req, mergeSchema)
  if (!parsed.ok) return parsed.response
  const { primaryId, secondaryId } = parsed.data

  if (primaryId === secondaryId) {
    return NextResponse.json({ error: "不能合併同一位客人" }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-scope BOTH customers to this shop INSIDE the tx (no TOCTOU).
      const [primary, secondary] = await Promise.all([
        tx.customer.findFirst({ where: { id: primaryId, shopId } }),
        tx.customer.findFirst({ where: { id: secondaryId, shopId } }),
      ])

      if (!primary || !secondary) return { notFound: true as const }

      await tx.pet.updateMany({ where: { customerId: secondaryId, shopId }, data: { customerId: primaryId } })
      await tx.payment.updateMany({ where: { customerId: secondaryId, shopId }, data: { customerId: primaryId } })
      await tx.pointsHistory.updateMany({ where: { customerId: secondaryId, shopId }, data: { customerId: primaryId } })
      await tx.storedValueHistory.updateMany({ where: { customerId: secondaryId, shopId }, data: { customerId: primaryId } })
      await tx.customer.update({
        where: { id: primaryId },
        data: { storedValue: { increment: secondary.storedValue }, points: { increment: secondary.points } },
      })
      await tx.customer.update({
        where: { id: secondaryId },
        data: { status: "MERGED", storedValue: 0, points: 0 },
      })

      await writeAudit({
        shopId,
        userId,
        action: "MERGE_CUSTOMER",
        resource: "Customer",
        resourceId: primaryId,
        detail: { primaryId, secondaryId, secondaryName: secondary.name },
      })

      return { notFound: false as const }
    })

    if (result.notFound) {
      return NextResponse.json({ error: "客人不存在" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST /api/customers/merge", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
