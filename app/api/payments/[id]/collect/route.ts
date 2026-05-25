// SECURITY: 已通過多店家隔離稽核 (2026-05-22)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId

  let body: {
    billingType: string
    paymentMethod?: string
    monthlyPlanData?: {
      name: string
      maxSessions: number
      pricePerSession: number
      startDate: string
      endDate: string
    }
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 })
  }

  const { billingType, paymentMethod, monthlyPlanData } = body

  if (!billingType) return NextResponse.json({ error: "請選擇計費方式" }, { status: 400 })
  if ((billingType === "SINGLE") && !paymentMethod) {
    return NextResponse.json({ error: "請選擇付款方式" }, { status: 400 })
  }
  if (billingType === "NEW_MONTHLY_PLAN" && (!paymentMethod || !monthlyPlanData)) {
    return NextResponse.json({ error: "請填寫包月方案資料及付款方式" }, { status: 400 })
  }

  try {
    const payment = await prisma.payment.findFirst({
      where: { id, shopId, status: "PENDING" },
    })
    if (!payment) return NextResponse.json({ error: "找不到待收款紀錄" }, { status: 404 })

    const customerId = payment.customerId
    const petId = payment.petId

    const result = await prisma.$transaction(async (tx) => {
      let finalAmount = payment.amount
      let resolvedMonthlyPlanId: string | null = null

      if (billingType === "CREDIT") {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { storedValue: true },
        })
        if (!customer || customer.storedValue < finalAmount) {
          throw new Error("儲值金餘額不足")
        }
        await tx.customer.update({
          where: { id: customerId },
          data: { storedValue: { decrement: finalAmount } },
        })
        await tx.storedValueHistory.create({
          data: {
            customerId,
            shopId,
            amount: -finalAmount,
            reason: `美容消費儲值扣款 ${finalAmount} 元`,
          },
        })
      } else if (billingType === "MONTHLY_PLAN") {
        if (!petId) throw new Error("找不到寵物資料")
        const now = new Date()
        const plans = await tx.petMonthlyPlan.findMany({
          where: { shopId, petId, startDate: { lte: now }, endDate: { gte: now } },
          orderBy: { startDate: "asc" },
        })
        const plan = plans.find((p) => p.usedSessions < p.maxSessions) ?? null
        if (!plan) throw new Error("此寵物無有效包月方案，請確認方案日期與剩餘次數")
        finalAmount = plan.pricePerSession
        resolvedMonthlyPlanId = plan.id
        await tx.petMonthlyPlan.update({
          where: { id: plan.id },
          data: { usedSessions: { increment: 1 } },
        })
      } else if (billingType === "NEW_MONTHLY_PLAN") {
        if (!petId || !monthlyPlanData) throw new Error("包月方案資料不完整")
        const newPlan = await tx.petMonthlyPlan.create({
          data: {
            shopId,
            petId,
            name: monthlyPlanData.name,
            maxSessions: monthlyPlanData.maxSessions,
            pricePerSession: monthlyPlanData.pricePerSession,
            startDate: new Date(monthlyPlanData.startDate),
            endDate: new Date(monthlyPlanData.endDate),
            usedSessions: 1,
          },
        })
        finalAmount = monthlyPlanData.pricePerSession
        resolvedMonthlyPlanId = newPlan.id
      }

      // Award points (1 per $100)
      const pointsEarned = Math.floor(finalAmount / 100)
      if (pointsEarned > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: { points: { increment: pointsEarned } },
        })
        await tx.pointsHistory.create({
          data: {
            customerId,
            shopId,
            points: pointsEarned,
            reason: `美容收款 ${finalAmount} 元，累積 ${pointsEarned} 點`,
          },
        })
      }

      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: "PAID",
          billingType,
          paymentMethod: paymentMethod ?? null,
          monthlyPlanId: resolvedMonthlyPlanId,
          amount: finalAmount,
          paidAt: new Date(),
        },
      })

      return updated
    })

    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "操作失敗，請稍後再試"
    const isUserError = ["儲值金餘額不足", "無有效包月方案", "包月方案資料不完整"].some((s) => msg.includes(s))
    if (isUserError) return NextResponse.json({ error: msg }, { status: 400 })
    console.error("POST /api/payments/[id]/collect", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
