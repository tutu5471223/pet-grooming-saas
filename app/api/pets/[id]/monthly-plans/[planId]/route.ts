// SECURITY: shopId forced from session
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { readJson, z, shortText } from "@/lib/validation"
import { parseMoney } from "@/lib/money"

const updatePlanSchema = z.object({
  name: shortText.min(1).optional(),
  maxSessions: z.number().finite().optional(),
  pricePerSession: z.number().finite().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: shortText.nullish(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const shopId = guard.ctx.shopId
  const role = guard.ctx.role
  const { id: petId, planId } = await params

  try {
    // Verify the plan belongs to {petId, shopId} before mutating.
    const plan = await prisma.petMonthlyPlan.findFirst({
      where: { id: planId, petId, shopId },
    })
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const parsed = await readJson(req, updatePlanSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data

    // Determine whether the request touches financial fields.
    const wantsMaxSessions =
      body.maxSessions !== undefined && Math.trunc(body.maxSessions) !== plan.maxSessions
    let nextPrice: number | null = null
    if (body.pricePerSession !== undefined) {
      nextPrice = parseMoney(body.pricePerSession, { allowZero: true })
      if (nextPrice === null) {
        return NextResponse.json({ error: "價格無效" }, { status: 400 })
      }
    }
    const wantsPrice = nextPrice !== null && nextPrice !== plan.pricePerSession
    const touchesFinancial = wantsMaxSessions || wantsPrice

    // FIN-10: price / financial-field changes are OWNER-only.
    if (touchesFinancial && role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // FIN-10: reject maxSessions below sessions already consumed.
    const nextMaxSessions =
      body.maxSessions !== undefined ? Math.trunc(body.maxSessions) : plan.maxSessions
    if (nextMaxSessions < 1 || nextMaxSessions < plan.usedSessions) {
      return NextResponse.json(
        { error: "可用次數不可少於已使用次數" },
        { status: 400 }
      )
    }

    // FIN-10: prevent editing financial fields when a payment is already PAID
    // (best effort — avoids changing the value of an already-settled plan).
    if (touchesFinancial) {
      const paidCount = await prisma.payment.count({
        where: { monthlyPlanId: planId, shopId, status: "PAID" },
      })
      if (paidCount > 0) {
        return NextResponse.json(
          { error: "此方案已有付款紀錄，無法修改金額或次數" },
          { status: 409 }
        )
      }
    }

    const updated = await prisma.petMonthlyPlan.update({
      where: { id: planId },
      data: {
        name: body.name ?? plan.name,
        maxSessions: nextMaxSessions,
        pricePerSession: nextPrice !== null ? nextPrice : plan.pricePerSession,
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
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const shopId = guard.ctx.shopId
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
