// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId
  const body = await req.json()

  try {
    const payment = await prisma.payment.findFirst({ where: { id, shopId } })
    if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status: body.status ?? payment.status,
        paymentMethod: body.paymentMethod ?? payment.paymentMethod,
        notes: body.notes ?? payment.notes,
        paidAt: body.paidAt ? new Date(body.paidAt) : payment.paidAt,
      },
    })

    await writeAudit({
      shopId,
      userId: session.user.id,
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
