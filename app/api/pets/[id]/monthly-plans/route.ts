// SECURITY: shopId forced from session
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopId = session.user.shopId
  const { id: petId } = await params
  const activeOnly = new URL(req.url).searchParams.get("active") === "true"

  try {
    const pet = await prisma.pet.findFirst({ where: { id: petId, shopId } })
    if (!pet) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const now = new Date()
    const plans = await prisma.petMonthlyPlan.findMany({
      where: {
        petId,
        shopId,
        ...(activeOnly ? { startDate: { lte: now }, endDate: { gte: now } } : {}),
      },
      orderBy: { startDate: "desc" },
    })

    if (activeOnly) {
      const activePlan = plans.find((p) => p.usedSessions < p.maxSessions) ?? null
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
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopId = session.user.shopId
  const { id: petId } = await params

  try {
    const pet = await prisma.pet.findFirst({ where: { id: petId, shopId } })
    if (!pet) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await req.json()
    const maxSessions = Number(body.maxSessions)
    const pricePerSession = Number(body.pricePerSession)
    if (!body.name || !body.startDate || !body.endDate || !maxSessions || pricePerSession < 0 || maxSessions < 1) {
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
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          notes: body.notes || null,
        },
      })

      const totalAmount = maxSessions * pricePerSession
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
