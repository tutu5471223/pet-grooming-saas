// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const { id } = await params
  const body = await req.json()

  try {
    const existing = await prisma.payment.findFirst({ where: { id, shopId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const payment = await prisma.payment.update({
      where: { id },
      data: {
        status: body.status ?? undefined,
        paymentMethod: body.paymentMethod ?? undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        paidAt: body.status === "PAID" ? new Date() : undefined,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
    })

    await writeAudit({
      shopId,
      userId: session.user.id,
      action: "UPDATE_RECEIVABLE",
      resource: "Payment",
      resourceId: id,
      detail: { status: body.status, amount: existing.amount },
    })

    return NextResponse.json(payment)
  } catch (error) {
    console.error("PATCH /api/receivables/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const shopId = session.user.shopId
  const { id } = await params

  try {
    const existing = await prisma.payment.findFirst({ where: { id, shopId, status: "PENDING" } })
    if (!existing) return NextResponse.json({ error: "Not found or already paid" }, { status: 404 })

    await prisma.payment.delete({ where: { id } })

    await writeAudit({
      shopId,
      userId: session.user.id,
      action: "DELETE_RECEIVABLE",
      resource: "Payment",
      resourceId: id,
      detail: { amount: existing.amount },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/receivables/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
