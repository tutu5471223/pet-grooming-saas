import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response

  const { shopId } = guard.ctx
  const { id } = await params
  const body = await req.json()
  const { type, amount, reason } = body

  const qty = Number(amount)
  if (!qty || qty <= 0 || !Number.isInteger(qty)) {
    return NextResponse.json({ error: "請輸入有效的正整數點數" }, { status: 400 })
  }
  if (!reason?.trim()) {
    return NextResponse.json({ error: "請填寫調整原因" }, { status: 400 })
  }

  try {
    // SECURITY: Verify customer belongs to this shop
    const customer = await prisma.customer.findFirst({
      where: { id, shopId },
      select: { id: true, points: true },
    })
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    if (type === "deduct" && customer.points < qty) {
      return NextResponse.json({ error: "點數不足，無法扣點" }, { status: 400 })
    }

    const delta = type === "add" ? qty : -qty

    const updated = await prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: { points: { increment: delta } },
        select: { points: true },
      })
      await tx.pointsHistory.create({
        data: { customerId: id, shopId, points: delta, reason },
      })
      return updatedCustomer
    })

    return NextResponse.json({ points: updated.points })
  } catch (error) {
    console.error("POST /api/customers/[id]/points", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
