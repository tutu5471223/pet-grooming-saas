// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { requireAuth } from "@/lib/auth-guard"
import { readJson, shortText, z } from "@/lib/validation"
import { isPaymentMethod } from "@/lib/payment-fee"

const patchSchema = z.object({
  status: shortText.optional(),
  paymentMethod: shortText.optional(),
  notes: shortText.optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  const { id } = await params

  const parsed = await readJson(req, patchSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const payment = await prisma.payment.findFirst({ where: { id, shopId } })
    if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // R6-H4: 這支通用 PATCH 不再允許任何狀態轉換。以前 OWNER 可把 PAID 改回
    // PENDING 再收一次款（儲值重扣、點數重發、包月重扣次），或寫入任意狀態字串。
    // 每種轉換都有專屬流程：收款 collect、作廢 receivables(VOIDED)、退款 refund。
    if (body.status !== undefined && body.status !== payment.status) {
      return NextResponse.json(
        { error: "請使用收款、作廢或退款功能變更款項狀態", code: "USE_DEDICATED_FLOW" },
        { status: 400 }
      )
    }

    // 付款方式：白名單，且只能在收款前調整 —— 收款後手續費已依付款方式快照，
    // 事後改付款方式會讓手續費、報表分組與實際金流對不上。
    if (body.paymentMethod !== undefined) {
      if (!isPaymentMethod(body.paymentMethod)) {
        return NextResponse.json({ error: "付款方式不正確" }, { status: 400 })
      }
      if (payment.status !== "PENDING" && body.paymentMethod !== payment.paymentMethod) {
        return NextResponse.json({ error: "已收款的款項不可變更付款方式" }, { status: 400 })
      }
    }

    await prisma.payment.updateMany({
      where: { id, shopId },
      data: {
        paymentMethod: body.paymentMethod ?? payment.paymentMethod,
        notes: body.notes ?? payment.notes,
      },
    })
    const updated = await prisma.payment.findFirst({ where: { id, shopId } })
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await writeAudit({
      shopId,
      userId,
      action: "UPDATE_PAYMENT",
      resource: "Payment",
      resourceId: id,
      detail: { status: updated.status },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/payments/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
