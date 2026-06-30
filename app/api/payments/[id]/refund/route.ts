// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-guard"
import { readJson, positiveMoney, shortText, z } from "@/lib/validation"
import { round2 } from "@/lib/money"

const refundSchema = z.object({
  amount: positiveMoney,
  reason: shortText.optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  const { id } = await params

  const parsed = await readJson(req, refundSchema)
  if (!parsed.ok) return parsed.response
  const amount = round2(parsed.data.amount)
  const reason = parsed.data.reason

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-read original payment inside the tx, scoped + status-gated.
      const payment = await tx.payment.findFirst({
        where: { id, shopId, status: "PAID" },
      })
      if (!payment) {
        throw new Error("REFUND_NOT_FOUND")
      }

      const alreadyRefunded = round2(payment.refundedAmount ?? 0)
      const newRefundedTotal = round2(alreadyRefunded + amount)
      if (newRefundedTotal > round2(payment.amount)) {
        throw new Error("REFUND_EXCEEDS")
      }

      // Atomically bump the original payment's refundedAmount; flip to
      // REFUNDED when fully refunded, otherwise keep PAID.
      //
      // The ceiling is enforced INSIDE the WHERE (refundedAmount <= amount - thisRefund)
      // so it is re-evaluated under the row lock at update time. This closes the
      // concurrent-partial-refund race: the cumulative check above is a stale read,
      // but the conditional updateMany cannot let two concurrent partial refunds
      // push refundedAmount past the original amount — the second to commit sees the
      // first's value and matches 0 rows.
      const fullyRefunded = newRefundedTotal >= round2(payment.amount)
      const maxPriorRefunded = round2(round2(payment.amount) - amount)
      const bumped = await tx.payment.updateMany({
        where: { id, shopId, status: "PAID", refundedAmount: { lte: maxPriorRefunded } },
        data: {
          refundedAmount: { increment: amount },
          ...(fullyRefunded ? { status: "REFUNDED" } : {}),
        },
      })
      if (bumped.count !== 1) {
        // Either the payment is no longer PAID/found, or a concurrent refund
        // would push the cumulative total over the original amount.
        throw new Error("REFUND_EXCEEDS")
      }

      const refund = await tx.payment.create({
        data: {
          shopId,
          customerId: payment.customerId,
          amount: round2(-amount),
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

      // L1: claw back the loyalty points that this collection granted. collect()
      // awards floor(amount / 100) points (1 per $100), so a refund of `amount`
      // reverses floor(amount / 100) points — the symmetric inverse. Summing this
      // over multiple partial refunds can never exceed the points originally
      // granted (floor(a/100)+floor(b/100) <= floor((a+b)/100)). Clamp to the
      // customer's current balance so points can never go negative, and use a
      // guarded updateMany (where points >= clawback) under the row lock.
      const pointsClawback = Math.floor(amount / 100)
      if (pointsClawback > 0) {
        const cust = await tx.customer.findFirst({
          where: { id: payment.customerId, shopId },
          select: { points: true },
        })
        const actualClawback = Math.min(pointsClawback, cust?.points ?? 0)
        if (actualClawback > 0) {
          const decremented = await tx.customer.updateMany({
            where: { id: payment.customerId, shopId, points: { gte: actualClawback } },
            data: { points: { decrement: actualClawback } },
          })
          if (decremented.count === 1) {
            await tx.pointsHistory.create({
              data: {
                customerId: payment.customerId,
                shopId,
                points: -actualClawback,
                reason: `退款回收點數 ${actualClawback} 點（原付款 #${id.slice(-6)}）`,
              },
            })
          }
        }
      }

      return refund
    })

    await writeAudit({
      shopId,
      userId,
      action: "REFUND_PAYMENT",
      resource: "Payment",
      resourceId: id,
      detail: { amount, reason },
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : ""
    if (msg === "REFUND_NOT_FOUND") {
      return NextResponse.json({ error: "找不到付款紀錄" }, { status: 404 })
    }
    if (msg === "REFUND_EXCEEDS") {
      return NextResponse.json({ error: "退款金額不能超過原金額（含已退款）" }, { status: 400 })
    }
    console.error("POST /api/payments/[id]/refund", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
