// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { requireRole, requirePermission } from "@/lib/auth-guard"
import { readJson, z } from "@/lib/validation"
import { computeFee, isPaymentMethod } from "@/lib/payment-fee"
import { loadFeeContext, recordFeeExpense } from "@/lib/payment-fee-server"

const patchSchema = z.object({
  status: z.enum(["PENDING", "PAID", "VOIDED"]).optional(),
  paymentMethod: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Parse body first to determine the operation, then apply the correct guard.
  const parsed = await readJson(req, patchSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  // Void requires OWNER role OR the "void" permission.
  // All other status-changing ops (PENDING->PAID, notes updates) remain OWNER-only.
  const isVoidRequest = body.status === "VOIDED"
  const guard = isVoidRequest
    ? await requirePermission("void")
    : await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  const { id } = await params

  const markingPaid = body.status === "PAID"
  const markingVoided = body.status === "VOIDED"

  try {
    const existing = await prisma.payment.findFirst({ where: { id, shopId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Void: 只允許作廢「未收款(PENDING)」的帳款。已收款(PAID/REFUNDED)不可直接
    // 作廢——那會抹掉已發生的金流（儲值扣抵/收入/點數）而不回退，帳會不平；
    // 已收款要沖銷請改用「退款」流程。
    if (markingVoided) {
      if (existing.status === "VOIDED") {
        return NextResponse.json(existing) // idempotent
      }
      if (existing.status !== "PENDING") {
        return NextResponse.json(
          { error: "只有未收款的帳款可以作廢；已收款請改用退款功能", code: "VOID_ONLY_PENDING" },
          { status: 400 }
        )
      }
      await prisma.payment.updateMany({
        where: { id, shopId, status: "PENDING" },
        data: { status: "VOIDED" },
      })
      await writeAudit({
        shopId,
        userId,
        action: "VOID_RECEIVABLE",
        resource: "Payment",
        resourceId: id,
        detail: { amount: existing.amount, previousStatus: existing.status },
      })
      const voided = await prisma.payment.findFirst({ where: { id, shopId } })
      return NextResponse.json(voided)
    }

    // Settling CREDIT / MONTHLY_PLAN receivables has accounting side effects
    // (stored-value deduction, monthly-plan session consumption, points) that
    // live in the collect endpoint. PATCH must NOT silently bypass them.
    if (markingPaid && existing.status === "PENDING") {
      if (existing.billingType === "CREDIT" || existing.billingType === "MONTHLY_PLAN") {
        return NextResponse.json(
          {
            error: "此筆款項需透過收款流程結算（涉及儲值金/包月方案扣抵），請使用收款功能",
            code: "USE_COLLECT_ENDPOINT",
          },
          { status: 422 }
        )
      }

      // FEE-2: 手續費要算得出來，收款當下就必須知道付款方式。以前這條路徑
      // 允許不帶 paymentMethod 直接標記已收款，結果是同一筆應收走「收款」
      // 對話框會扣手續費、走這裡卻永遠 0 元，且付款方式留白。
      const method = body.paymentMethod ?? existing.paymentMethod ?? null
      if (!isPaymentMethod(method)) {
        return NextResponse.json(
          { error: "請選擇付款方式（現金／刷卡／轉帳／LINE Pay）", code: "PAYMENT_METHOD_REQUIRED" },
          { status: 400 }
        )
      }

      const { rates, creatorId } = await loadFeeContext(shopId, userId)
      const fee = computeFee(existing.amount, method, rates)

      // Atomic PENDING -> PAID for SINGLE receivables only. 手續費支出與狀態
      // 翻轉放同一個 transaction，避免收款成立卻漏記手續費。
      const flipped = await prisma.$transaction(async (tx) => {
        const flip = await tx.payment.updateMany({
          where: { id, shopId, status: "PENDING" },
          data: {
            status: "PAID",
            paidAt: new Date(),
            paymentMethod: method,
            feeRate: fee.feeRate,
            feeAmount: fee.feeAmount,
            netAmount: fee.netAmount,
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
          },
        })
        if (flip.count !== 1) return false
        await recordFeeExpense(tx, {
          shopId,
          creatorId,
          fee,
          paymentMethod: method,
          source: `收款 #${id.slice(-6)}`,
        })
        return true
      })
      if (!flipped) {
        // Already processed by another request.
        return NextResponse.json({ error: "Not found or already paid" }, { status: 409 })
      }

      const payment = await prisma.payment.findFirst({
        where: { id, shopId },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
      })

      await writeAudit({
        shopId,
        userId,
        action: "MARK_RECEIVABLE_PAID",
        resource: "Payment",
        resourceId: id,
        detail: { amount: existing.amount, billingType: existing.billingType },
      })

      return NextResponse.json(payment)
    }

    // Non-status edits (paymentMethod / notes), or no-op status writes that do
    // not constitute a PENDING -> PAID transition. We never flip PAID -> PENDING here.
    if (body.paymentMethod !== undefined && !isPaymentMethod(body.paymentMethod)) {
      return NextResponse.json({ error: "付款方式不正確" }, { status: 400 })
    }
    const payment = await prisma.payment.update({
      where: { id },
      data: {
        paymentMethod: body.paymentMethod ?? undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
    })

    await writeAudit({
      shopId,
      userId,
      action: "UPDATE_RECEIVABLE",
      resource: "Payment",
      resourceId: id,
      detail: { status: existing.status, amount: existing.amount },
    })

    return NextResponse.json(payment)
  } catch (error) {
    console.error("PATCH /api/receivables/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  const { id } = await params

  try {
    // Atomic, shopId-scoped delete of PENDING receivables only.
    const deleted = await prisma.payment.deleteMany({ where: { id, shopId, status: "PENDING" } })
    if (deleted.count !== 1) {
      return NextResponse.json({ error: "Not found or already paid" }, { status: 404 })
    }

    await writeAudit({
      shopId,
      userId,
      action: "DELETE_RECEIVABLE",
      resource: "Payment",
      resourceId: id,
      detail: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/receivables/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
