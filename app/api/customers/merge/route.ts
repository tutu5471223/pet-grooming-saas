// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const shopId = session.user.shopId
  const { primaryId, secondaryId } = await req.json()

  if (primaryId === secondaryId) {
    return NextResponse.json({ error: "不能合併同一位客人" }, { status: 400 })
  }

  try {
    const [primary, secondary] = await Promise.all([
      prisma.customer.findFirst({ where: { id: primaryId, shopId } }),
      prisma.customer.findFirst({ where: { id: secondaryId, shopId } }),
    ])

    if (!primary || !secondary) {
      return NextResponse.json({ error: "客人不存在" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.pet.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } })
      await tx.payment.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } })
      await tx.pointsHistory.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } })
      await tx.storedValueHistory.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } })
      await tx.customer.update({
        where: { id: primaryId },
        data: { storedValue: { increment: secondary.storedValue }, points: { increment: secondary.points } },
      })
      await tx.customer.update({
        where: { id: secondaryId },
        data: { status: "MERGED", storedValue: 0, points: 0 },
      })
    })

    await writeAudit({
      shopId,
      userId: session.user.id,
      action: "MERGE_CUSTOMER",
      resource: "Customer",
      resourceId: primaryId,
      detail: { primaryId, secondaryId, secondaryName: secondary.name },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST /api/customers/merge", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
