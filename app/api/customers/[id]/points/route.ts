import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { readJson, z } from "@/lib/validation"
import { writeAudit } from "@/lib/audit"

const MAX_POINTS_ADJUST = 1_000_000

const pointsSchema = z.object({
  type: z.enum(["add", "deduct"]),
  amount: z.number().int().positive().max(MAX_POINTS_ADJUST),
  reason: z.string().trim().min(1).max(500),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // FIN-8: manual points adjustment is OWNER-only
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response

  const { shopId, userId } = guard.ctx
  const { id } = await params

  const parsed = await readJson(req, pointsSchema)
  if (!parsed.ok) return parsed.response
  const { type, amount, reason } = parsed.data

  const qty = amount

  try {
    // SECURITY: Verify customer belongs to this shop
    const customer = await prisma.customer.findFirst({
      where: { id, shopId },
      select: { id: true },
    })
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const delta = type === "add" ? qty : -qty

    const result = await prisma.$transaction(async (tx) => {
      if (type === "deduct") {
        // Atomic guarded decrement: only succeeds if points are sufficient.
        const dec = await tx.customer.updateMany({
          where: { id, shopId, points: { gte: qty } },
          data: { points: { decrement: qty } },
        })
        if (dec.count !== 1) return null // insufficient points / already changed
      } else {
        await tx.customer.update({
          where: { id },
          data: { points: { increment: qty } },
        })
      }

      const updatedCustomer = await tx.customer.findFirst({
        where: { id, shopId },
        select: { points: true },
      })

      await tx.pointsHistory.create({
        data: { customerId: id, shopId, points: delta, reason },
      })

      await writeAudit({
        shopId,
        userId,
        action: type === "add" ? "POINTS_ADD" : "POINTS_DEDUCT",
        resource: "Customer",
        resourceId: id,
        detail: { type, amount: qty, reason },
      })

      return updatedCustomer
    })

    if (result === null) {
      return NextResponse.json({ error: "點數不足，無法扣點" }, { status: 400 })
    }

    return NextResponse.json({ points: result.points })
  } catch (error) {
    console.error("POST /api/customers/[id]/points", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
