// SECURITY: shopId forced from session
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { readJson, z, shortText } from "@/lib/validation"
import { parseMoney, round2 } from "@/lib/money"

const EXPIRY_POLICIES = ["FORFEIT", "GRACE_PERIOD", "PERMANENT"] as const

const createPlanSchema = z.object({
  name: shortText.min(1),
  maxSessions: z.number().finite(),
  pricePerSession: z.number().finite(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: shortText.nullish(),
  expiryPolicy: z.enum(EXPIRY_POLICIES).optional(),
  graceDays: z.number().int().min(1).max(365).optional(),
})

function parseTaipeiDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+08:00`)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const shopId = guard.ctx.shopId
  const { id: petId } = await params
  const activeOnly = new URL(req.url).searchParams.get("active") === "true"

  try {
    const pet = await prisma.pet.findFirst({ where: { id: petId, shopId } })
    if (!pet) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const now = new Date()
    const plans = await prisma.petMonthlyPlan.findMany({
      where: { petId, shopId },
      orderBy: { startDate: "desc" },
    })

    if (activeOnly) {
      const activePlan = plans.find((p) => {
        if (p.usedSessions >= p.maxSessions) return false
        if (now < p.startDate) return false
        if (now <= p.endDate) return true
        if (p.expiryPolicy === "PERMANENT") return true
        if (p.expiryPolicy === "GRACE_PERIOD") {
          const graceEnd = new Date(p.endDate)
          graceEnd.setDate(graceEnd.getDate() + (p.graceDays ?? 7))
          return now <= graceEnd
        }
        return false
      }) ?? null
      return NextResponse.json(activePlan)
    }

    return NextResponse.json(plans)
  } catch (error) {
    console.error("GET /api/pets/[id]/monthly-plans", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const shopId = guard.ctx.shopId
  const { id: petId } = await params

  try {
    const pet = await prisma.pet.findFirst({ where: { id: petId, shopId } })
    if (!pet) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const parsed = await readJson(req, createPlanSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data

    const maxSessions = Math.trunc(body.maxSessions)
    const pricePerSession = parseMoney(body.pricePerSession, { allowZero: true })
    if (pricePerSession === null || maxSessions < 1) {
      return NextResponse.json({ error: "缺少必填欄位或資料無效" }, { status: 400 })
    }
    const startDate = parseTaipeiDate(body.startDate)
    const endDate = parseTaipeiDate(body.endDate)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "缺少必填欄位或資料無效" }, { status: 400 })
    }

    const plan = await prisma.$transaction(async (tx) => {
      const newPlan = await tx.petMonthlyPlan.create({
        data: {
          shopId,
          petId,
          name: body.name,
          maxSessions,
          pricePerSession,
          startDate,
          endDate,
          notes: body.notes || null,
          expiryPolicy: body.expiryPolicy ?? "FORFEIT",
          graceDays: body.graceDays ?? 7,
        },
      })

      const totalAmount = round2(maxSessions * pricePerSession)
      if (totalAmount > 0) {
        await tx.payment.create({
          data: {
            shopId,
            customerId: pet.customerId,
            petId,
            monthlyPlanId: newPlan.id,
            amount: totalAmount,
            billingType: "MONTHLY_PLAN",
            status: "PENDING",
            notes: `包月方案：${body.name}（${maxSessions}次 × ${pricePerSession}元）`,
          },
        })
      }

      return newPlan
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error("POST /api/pets/[id]/monthly-plans", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
