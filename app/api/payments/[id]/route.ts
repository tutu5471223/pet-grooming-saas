// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { requireAuth } from "@/lib/auth-guard"
import { readJson, shortText, z } from "@/lib/validation"

const patchSchema = z.object({
  status: shortText.optional(),
  paymentMethod: shortText.optional(),
  notes: shortText.optional(),
  paidAt: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId, userId, role } = guard.ctx

  const { id } = await params

  const parsed = await readJson(req, patchSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const payment = await prisma.payment.findFirst({ where: { id, shopId } })
    if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // FIN-9: status changes are a financial mutation — OWNER only, and the
    // PENDING->PAID transition must NOT be possible through this generic PATCH
    // (it has side effects: balance/points/sessions) — force it through collect().
    const wantsStatusChange =
      body.status !== undefined && body.status !== payment.status
    if (wantsStatusChange) {
      if (role !== "OWNER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      if (payment.status === "PENDING" && body.status === "PAID") {
        return NextResponse.json(
          { error: "請使用收款流程 (collect) 收取待收款項" },
          { status: 400 }
        )
      }
    }

    const nextStatus = wantsStatusChange ? body.status! : payment.status

    await prisma.payment.updateMany({
      where: { id, shopId },
      data: {
        status: nextStatus,
        paymentMethod: body.paymentMethod ?? payment.paymentMethod,
        notes: body.notes ?? payment.notes,
        paidAt: body.paidAt ? new Date(body.paidAt) : payment.paidAt,
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
      detail: { status: updated.status, statusChanged: wantsStatusChange },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/payments/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
