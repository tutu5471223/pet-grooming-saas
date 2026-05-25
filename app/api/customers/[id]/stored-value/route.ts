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
  const { amount, method, notes } = body

  if (!amount || Number(amount) < 100) {
    return NextResponse.json({ error: "充值金額最低 100 元" }, { status: 400 })
  }

  const topupAmount = Number(amount)

  try {
    // SECURITY: Verify customer belongs to this shop
    const customer = await prisma.customer.findFirst({
      where: { id, shopId },
      select: { id: true },
    })
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const methodLabel = method === "CARD" ? "刷卡" : "現金"
    const reason = `儲值充值（${methodLabel}）${notes ? `：${notes}` : ""}`

    const updated = await prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: { storedValue: { increment: topupAmount } },
        select: { storedValue: true },
      })
      await tx.storedValueHistory.create({
        data: { customerId: id, shopId, amount: topupAmount, reason },
      })
      return updatedCustomer
    })

    return NextResponse.json({ storedValue: updated.storedValue })
  } catch (error) {
    console.error("POST /api/customers/[id]/stored-value", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
