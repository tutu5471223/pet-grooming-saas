// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const shopId = session.user.shopId
  const { amount: rawAmount, reason } = await req.json()
  const amount = Number(rawAmount)

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "退款金額必須大於 0" }, { status: 400 })
  }

  try {
    const payment = await prisma.payment.findFirst({ where: { id, shopId, status: "PAID" } })
    if (!payment) return NextResponse.json({ error: "找不到付款紀錄" }, { status: 404 })

    if (amount > payment.amount) {
      return NextResponse.json({ error: "退款金額不能超過原金額" }, { status: 400 })
    }

    const refundRecord = await prisma.$transaction(async (tx) => {
      const refund = await tx.payment.create({
        data: {
          shopId,
          customerId: payment.customerId,
          amount: -amount,
          billingType: "SINGLE",
          paymentMethod: payment.paymentMethod,
          status: "PAID",
          notes: `退款：${reason ?? ""}（原付款 #${id.slice(-6)}）`,
          paidAt: new Date(),
        },
      })

      if (payment.billingType === "CREDIT") {
        await tx.customer.update({
          where: { id: payment.customerId },
          data: { storedValue: { increment: amount } },
        })
        await tx.storedValueHistory.create({
          data: {
            customerId: payment.customerId,
            shopId,
            amount,
            reason: `退款：${reason ?? ""}`,
          },
        })
      }

      return refund
    })

    await writeAudit({
      shopId,
      userId: session.user.id,
      action: "REFUND_PAYMENT",
      resource: "Payment",
      resourceId: id,
      detail: { amount, reason },
    })

    return NextResponse.json(refundRecord, { status: 201 })
  } catch (error) {
    console.error("POST /api/payments/[id]/refund", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
