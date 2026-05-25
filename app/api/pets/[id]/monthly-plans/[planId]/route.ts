// SECURITY: shopId forced from session
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopId = session.user.shopId
  const { id: petId, planId } = await params

  try {
    const plan = await prisma.petMonthlyPlan.findFirst({
      where: { id: planId, petId, shopId },
    })
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await req.json()
    const updated = await prisma.petMonthlyPlan.update({
      where: { id: planId },
      data: {
        name: body.name ?? plan.name,
        maxSessions: body.maxSessions !== undefined ? Number(body.maxSessions) : plan.maxSessions,
        pricePerSession: body.pricePerSession !== undefined ? Number(body.pricePerSession) : plan.pricePerSession,
        startDate: body.startDate ? new Date(body.startDate) : plan.startDate,
        endDate: body.endDate ? new Date(body.endDate) : plan.endDate,
        notes: body.notes !== undefined ? body.notes : plan.notes,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/pets/[id]/monthly-plans/[planId]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopId = session.user.shopId
  const { id: petId, planId } = await params

  try {
    const plan = await prisma.petMonthlyPlan.findFirst({
      where: { id: planId, petId, shopId },
    })
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.petMonthlyPlan.delete({ where: { id: planId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE /api/pets/[id]/monthly-plans/[planId]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
