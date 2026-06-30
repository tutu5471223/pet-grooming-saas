// SECURITY: 已通過多店家隔離稽核 (2026-05-22)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { round2, parseMoney } from "@/lib/money"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // collect() is a normal counter operation — STAFF is allowed.
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { id } = await params

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

  // Validate the only client-supplied money inputs (new monthly plan pricing).
  // For SINGLE / CREDIT / existing-plan billing the amount is recomputed
  // server-side from the DB (never trust the client price).
  let validatedNewPlan:
    | { name: string; maxSessions: number; pricePerSession: number; startDate: string; endDate: string }
    | null = null
  if (billingType === "NEW_MONTHLY_PLAN" && monthlyPlanData) {
    const price = parseMoney(monthlyPlanData.pricePerSession, { allowZero: false })
    if (price === null) {
      return NextResponse.json({ error: "每次金額不正確" }, { status: 400 })
    }
    const maxSessions = Number(monthlyPlanData.maxSessions)
    if (!Number.isInteger(maxSessions) || maxSessions <= 0 || maxSessions > 10000) {
      return NextResponse.json({ error: "包月次數不正確" }, { status: 400 })
    }
    validatedNewPlan = {
      name: monthlyPlanData.name,
      maxSessions,
      pricePerSession: price,
      startDate: monthlyPlanData.startDate,
      endDate: monthlyPlanData.endDate,
    }
  }

  try {
    const payment = await prisma.payment.findFirst({
      where: { id, shopId, status: "PENDING" },
    })
    if (!payment) return NextResponse.json({ error: "找不到待收款紀錄" }, { status: 404 })

    // M2: the DB payment.billingType is authoritative for PACKAGE receivables.
    // A monthly-plan package purchase is created (in /pets/[id]/monthly-plans)
    // with billingType "MONTHLY_PLAN" and amount = maxSessions * pricePerSession
    // (the FULL package price). It MUST be collected at that stored amount. The
    // client must not be able to re-bill it through the per-session override
    // paths (MONTHLY_PLAN consumption / NEW_MONTHLY_PLAN), which would slash
    // finalAmount down to a single session price = silent under-collection.
    // Such a receivable may only be settled at full amount by cash/card (SINGLE)
    // or stored value (CREDIT). Plain SINGLE receivables are unaffected, so the
    // legitimate "apply this charge to a plan" and NEW_MONTHLY_PLAN flows still work.
    if (
      payment.billingType === "MONTHLY_PLAN" &&
      billingType !== "SINGLE" &&
      billingType !== "CREDIT"
    ) {
      return NextResponse.json(
        { error: "包月方案應收款須以全額收取（現金或儲值），不可逐次扣抵" },
        { status: 400 }
      )
    }

    const customerId = payment.customerId
    const petId = payment.petId

    const result = await prisma.$transaction(async (tx) => {
      let finalAmount = round2(payment.amount)
      // Preserve any existing plan link (e.g. a package receivable settled as
      // SINGLE/CREDIT). The consumption / new-plan branches reassign this below.
      let resolvedMonthlyPlanId: string | null = payment.monthlyPlanId ?? null

      if (billingType === "CREDIT") {
        // Re-read balance inside the tx.
        const customer = await tx.customer.findFirst({
          where: { id: customerId, shopId },
          select: { storedValue: true },
        })
        if (!customer || customer.storedValue < finalAmount) {
          throw new Error("儲值金餘額不足")
        }
      } else if (billingType === "MONTHLY_PLAN") {
        if (!petId) throw new Error("找不到寵物資料")
        const now = new Date()
        const plans = await tx.petMonthlyPlan.findMany({
          where: { shopId, petId, startDate: { lte: now }, endDate: { gte: now } },
          orderBy: { startDate: "asc" },
        })
        const plan = plans.find((p) => p.usedSessions < p.maxSessions) ?? null
        if (!plan) throw new Error("此寵物無有效包月方案，請確認方案日期與剩餘次數")
        finalAmount = round2(plan.pricePerSession)
        resolvedMonthlyPlanId = plan.id
        // FIN-3: atomic session decrement — only succeeds while there are
        // sessions left. count===0 => raced out / exhausted.
        const consumed = await tx.petMonthlyPlan.updateMany({
          where: { id: plan.id, shopId, usedSessions: { lt: plan.maxSessions } },
          data: { usedSessions: { increment: 1 } },
        })
        if (consumed.count !== 1) {
          throw new Error("此寵物無有效包月方案，請確認方案日期與剩餘次數")
        }
      } else if (billingType === "NEW_MONTHLY_PLAN") {
        if (!petId || !validatedNewPlan) throw new Error("包月方案資料不完整")
        const newPlan = await tx.petMonthlyPlan.create({
          data: {
            shopId,
            petId,
            name: validatedNewPlan.name,
            maxSessions: validatedNewPlan.maxSessions,
            pricePerSession: validatedNewPlan.pricePerSession,
            startDate: new Date(validatedNewPlan.startDate),
            endDate: new Date(validatedNewPlan.endDate),
            usedSessions: 1,
          },
        })
        finalAmount = round2(validatedNewPlan.pricePerSession)
        resolvedMonthlyPlanId = newPlan.id
      }

      finalAmount = round2(finalAmount)

      // FIN-2: atomic PENDING->PAID gate. Only one caller can flip it; a
      // second concurrent collect matches 0 rows and aborts.
      const flipped = await tx.payment.updateMany({
        where: { id, shopId, status: "PENDING" },
        data: {
          status: "PAID",
          billingType,
          paymentMethod: paymentMethod ?? null,
          monthlyPlanId: resolvedMonthlyPlanId,
          amount: finalAmount,
          paidAt: new Date(),
        },
      })
      if (flipped.count !== 1) {
        throw new Error("此筆款項已被收取")
      }

      // Side effects run ONLY after the gate succeeds.
      if (billingType === "CREDIT") {
        // Balance-guarded atomic debit: the WHERE re-checks storedValue under
        // the row lock, so two concurrent CREDIT collects on the SAME customer
        // (different pending payments) cannot both pass a stale balance read and
        // drive storedValue negative. count===0 => insufficient funds, rolls back.
        const debited = await tx.customer.updateMany({
          where: { id: customerId, shopId, storedValue: { gte: finalAmount } },
          data: { storedValue: { decrement: finalAmount } },
        })
        if (debited.count !== 1) {
          throw new Error("儲值金餘額不足")
        }
        await tx.storedValueHistory.create({
          data: {
            customerId,
            shopId,
            amount: round2(-finalAmount),
            reason: `美容消費儲值扣款 ${finalAmount} 元`,
          },
        })
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

      const updated = await tx.payment.findFirst({ where: { id, shopId } })
      return updated
    })

    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "操作失敗，請稍後再試"
    const isUserError = [
      "儲值金餘額不足",
      "無有效包月方案",
      "包月方案資料不完整",
      "已被收取",
    ].some((s) => msg.includes(s))
    if (isUserError) return NextResponse.json({ error: msg }, { status: 400 })
    console.error("POST /api/payments/[id]/collect", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
