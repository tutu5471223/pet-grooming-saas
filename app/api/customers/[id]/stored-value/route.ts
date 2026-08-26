import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { readJson, z, positiveMoney } from "@/lib/validation"
import { round2 } from "@/lib/money"
import { writeAudit } from "@/lib/audit"
import { computeFee } from "@/lib/payment-fee"
import { loadFeeContext, recordFeeExpense } from "@/lib/payment-fee-server"

const topupSchema = z.object({
  amount: positiveMoney,
  method: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(500).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response

  const { shopId, userId } = guard.ctx
  const { id } = await params

  const parsed = await readJson(req, topupSchema)
  if (!parsed.ok) return parsed.response
  const { amount, method, notes } = parsed.data

  if (amount < 100) {
    return NextResponse.json({ error: "充值金額最低 100 元" }, { status: 400 })
  }

  const topupAmount = round2(amount)

  try {
    // SECURITY: Verify customer belongs to this shop
    const customer = await prisma.customer.findFirst({
      where: { id, shopId },
      select: { id: true },
    })
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const methodLabel = method === "CARD" ? "刷卡" : "現金"
    const reason = `儲值充值（${methodLabel}）${notes ? `：${notes}` : ""}`

    // FEE-3: 儲值加值是真正的外部收款（現金或刷卡），手續費就發生在這一刻。
    // 之後的扣抵走 billingType=CREDIT、沒有付款方式、費率 0，所以如果這裡
    // 不算，刷卡儲值的手續費會完全沒有入帳。
    const payMethod = method === "CARD" ? "CARD" : "CASH"
    const { rates, creatorId } = await loadFeeContext(shopId, userId)
    const fee = computeFee(topupAmount, payMethod, rates)

    const updated = await prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: { storedValue: { increment: topupAmount } },
        select: { storedValue: true },
      })
      await tx.storedValueHistory.create({
        data: { customerId: id, shopId, amount: topupAmount, reason },
      })
      await recordFeeExpense(tx, {
        shopId,
        creatorId,
        fee,
        paymentMethod: payMethod,
        source: "儲值充值",
      })
      await writeAudit({
        shopId,
        userId,
        action: "STORED_VALUE_TOPUP",
        resource: "Customer",
        resourceId: id,
        detail: { amount: topupAmount, method: methodLabel },
      })
      return updatedCustomer
    })

    return NextResponse.json({ storedValue: updated.storedValue })
  } catch (error) {
    console.error("POST /api/customers/[id]/stored-value", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
