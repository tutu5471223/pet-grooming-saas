// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-guard"
import { readJson, z } from "@/lib/validation"

const patchSchema = z.object({
  status: z.enum(["PENDING", "PAID", "VOIDED"]).optional(),
  paymentMethod: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Status-changing PATCH (esp. PENDING -> PAID) is a financial action: OWNER only.
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  const { id } = await params

  const parsed = await readJson(req, patchSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const markingPaid = body.status === "PAID"
  const markingVoided = body.status === "VOIDED"

  try {
    const existing = await prisma.payment.findFirst({ where: { id, shopId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Void: mark as VOIDED regardless of current status (idempotent, no side effects).
    if (markingVoided) {
      if (existing.status === "VOIDED") {
        return NextResponse.json(existing)
      }
      await prisma.payment.updateMany({
        where: { id, shopId },
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

      // Atomic PENDING -> PAID for SINGLE receivables only.
      const flip = await prisma.payment.updateMany({
        where: { id, shopId, status: "PENDING" },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paymentMethod: body.paymentMethod ?? existing.paymentMethod ?? undefined,
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        },
      })
      if (flip.count !== 1) {
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
