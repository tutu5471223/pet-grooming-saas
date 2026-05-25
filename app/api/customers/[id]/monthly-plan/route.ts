import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx
  const { id: customerId } = await params

  const { planId, startDate } = await req.json()
  if (!planId || !startDate)
    return NextResponse.json({ error: "請提供方案與開始日期" }, { status: 400 })

  try {
    const [plan, customer] = await Promise.all([
      prisma.monthlyPlan.findFirst({ where: { id: planId, shopId } }),
      prisma.customer.findFirst({ where: { id: customerId, shopId } }),
    ])
    if (!plan) return NextResponse.json({ error: "找不到方案" }, { status: 404 })
    if (!customer) return NextResponse.json({ error: "找不到客人" }, { status: 404 })

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        monthlyPlanId: planId,
        monthlyPlanStartDate: new Date(startDate),
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error("POST /api/customers/[id]/monthly-plan", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx
  const { id: customerId } = await params

  try {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, shopId } })
    if (!customer) return NextResponse.json({ error: "找不到客人" }, { status: 404 })

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { monthlyPlanId: null, monthlyPlanStartDate: null },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error("DELETE /api/customers/[id]/monthly-plan", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
