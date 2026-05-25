// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId
  const body = await req.json()

  try {
    const existing = await prisma.appointment.findFirst({ where: { id, shopId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.appointment.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.staffId !== undefined && { staffId: body.staffId ?? null }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.scheduledAt && { scheduledAt: new Date(body.scheduledAt) }),
        ...(body.services !== undefined && { services: body.services !== null ? JSON.stringify(body.services) : null }),
        ...(body.estimatedCost !== undefined && { estimatedCost: body.estimatedCost ?? null }),
        ...(body.duration !== undefined && { duration: body.duration ?? null }),
        ...(body.petMonthlyPlanId !== undefined && { petMonthlyPlanId: body.petMonthlyPlanId ?? null }),
      },
    })

    // Auto-deduct monthly plan session on first completion
    if (body.status === "COMPLETED" && existing.status !== "COMPLETED" && existing.petMonthlyPlanId) {
      try {
        await prisma.petMonthlyPlan.update({
          where: { id: existing.petMonthlyPlanId },
          data: { usedSessions: { increment: 1 } },
        })
      } catch { /* plan may have been deleted */ }
    }

    const updated = await prisma.appointment.findFirst({
      where: { id },
      include: {
        pet: { include: { customer: true, contract: true } },
        staff: true,
        shop: { select: { name: true, phone: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/appointments/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId

  try {
    await prisma.appointment.deleteMany({ where: { id, shopId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/appointments/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
