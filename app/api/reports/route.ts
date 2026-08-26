// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth-guard"
import { round2 } from "@/lib/money"
import {
  startOfMonth,
  endOfMonth,
  endOfDay,
  subMonths,
  subDays,
  format,
  eachDayOfInterval,
} from "date-fns"

export async function GET(req: NextRequest) {
  // PERM-2: 營收數字對齊 /reports 頁面的權限（OWNER 或 reports 權限），
  // 否則沒有報表權限的店員仍可直接打 API 取得全店營收。
  const guard = await requirePermission("reports")
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { searchParams } = new URL(req.url)
  const monthParam = searchParams.get("month") // "2026-05"

  let monthDate: Date
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number)
    monthDate = new Date(y, m - 1, 1)
  } else {
    monthDate = new Date()
  }

  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const now = new Date()
  const effectiveEnd = monthEnd > now ? now : monthEnd

  try {
  // ── Core revenue data ──────────────────────────────────────────────────────
  const [
    monthRevenue,
    boardingRevenueStat,
    monthlyRevenue,
    paymentMethodsRaw,
    topServices,
    dailyRevenueRows,
  ] = await Promise.all([
    // M1: net revenue = sum(amount) - sum(refundedAmount) over original charges
    // (status PAID/REFUNDED, amount >= 0). The negative reversal rows are excluded
    // by amount >= 0, so each refund is counted exactly once (via refundedAmount).
    prisma.payment.aggregate({
      where: {
        shopId,
        status: { in: ["PAID", "REFUNDED"] },
        amount: { gte: 0 },
        paidAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true, refundedAmount: true },
      _count: true,
    }),

    prisma.payment.aggregate({
      where: {
        shopId,
        status: { in: ["PAID", "REFUNDED"] },
        amount: { gte: 0 },
        paidAt: { gte: monthStart, lte: monthEnd },
        boardingRecordId: { not: null },
      },
      _sum: { amount: true, refundedAmount: true },
      _count: true,
    }),

    Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(monthDate, 5 - i)
        const s = startOfMonth(d)
        const e = endOfMonth(d)
        return prisma.payment
          .aggregate({
            where: {
              shopId,
              status: { in: ["PAID", "REFUNDED"] },
              amount: { gte: 0 },
              paidAt: { gte: s, lte: e },
            },
            _sum: { amount: true, refundedAmount: true },
          })
          .then((r) => ({
            month: format(d, "M月"),
            revenue: round2((r._sum.amount ?? 0) - (r._sum.refundedAmount ?? 0)),
          }))
      })
    ),

    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: {
        shopId,
        status: { in: ["PAID", "REFUNDED"] },
        amount: { gte: 0 },
        paidAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true, refundedAmount: true },
      _count: true,
    }),

    prisma.groomingRecord.findMany({
      where: { shopId, date: { gte: monthStart, lte: monthEnd } },
      select: { services: true, totalCost: true },
    }),

    // M13: ONE range query (was up to 31 per-day aggregates). Reduced into per-day
    // net buckets in memory below.
    prisma.payment.findMany({
      where: {
        shopId,
        status: { in: ["PAID", "REFUNDED"] },
        amount: { gte: 0 },
        paidAt: { gte: monthStart, lte: endOfDay(effectiveEnd) },
      },
      select: { paidAt: true, amount: true, refundedAmount: true },
    }),
  ])

  // M1: net payment-method breakdown (keeps the { paymentMethod, _count, _sum.amount } shape).
  const paymentMethods = paymentMethodsRaw.map((g) => ({
    paymentMethod: g.paymentMethod,
    _count: g._count,
    _sum: { amount: round2((g._sum.amount ?? 0) - (g._sum.refundedAmount ?? 0)) },
  }))

  // M13: fold the single dailyRevenue range query into per-day net buckets.
  const dayBuckets = new Map<string, number>()
  for (const p of dailyRevenueRows) {
    if (!p.paidAt) continue
    const key = format(p.paidAt, "yyyy-MM-dd")
    const net = (p.amount ?? 0) - (p.refundedAmount ?? 0)
    dayBuckets.set(key, round2((dayBuckets.get(key) ?? 0) + net))
  }
  const dailyRevenue = eachDayOfInterval({ start: monthStart, end: effectiveEnd }).map((d) => ({
    day: format(d, "d"),
    revenue: dayBuckets.get(format(d, "yyyy-MM-dd")) ?? 0,
  }))

  // ── Service stats ──────────────────────────────────────────────────────────
  const serviceMap = new Map<string, { count: number; revenue: number }>()
  for (const record of topServices) {
    const svcs = JSON.parse(record.services) as { name: string; price: number }[]
    for (const svc of svcs) {
      const prev = serviceMap.get(svc.name) ?? { count: 0, revenue: 0 }
      serviceMap.set(svc.name, { count: prev.count + 1, revenue: prev.revenue + svc.price })
    }
  }
  const boardingRevenue = round2(
    (boardingRevenueStat._sum.amount ?? 0) - (boardingRevenueStat._sum.refundedAmount ?? 0)
  )
  const boardingCount = boardingRevenueStat._count

  // Add boarding as a synthetic service entry
  const serviceStatsRaw = Array.from(serviceMap.entries())
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
  const serviceStats = boardingRevenue > 0
    ? [...serviceStatsRaw, { name: "住宿費", count: boardingCount, revenue: boardingRevenue }].sort((a, b) => b.revenue - a.revenue).slice(0, 9)
    : serviceStatsRaw

  // ── 16a: Staff performance ─────────────────────────────────────────────────
  const groomingWithGroomer = await prisma.groomingRecord.findMany({
    where: { shopId, date: { gte: monthStart, lte: monthEnd }, groomerId: { not: null } },
    include: { groomer: true },
  })

  const staffMap = new Map<string, { name: string; count: number; revenue: number }>()
  for (const rec of groomingWithGroomer) {
    if (!rec.groomerId || !rec.groomer) continue
    const prev = staffMap.get(rec.groomerId) ?? { name: rec.groomer.name, count: 0, revenue: 0 }
    staffMap.set(rec.groomerId, { name: prev.name, count: prev.count + 1, revenue: prev.revenue + rec.totalCost })
  }
  const staffStats = Array.from(staffMap.entries())
    .map(([groomerId, s]) => ({
      groomerId,
      groomerName: s.name,
      count: s.count,
      revenue: s.revenue,
      avg: s.count > 0 ? Math.round(s.revenue / s.count) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  // ── 16b: Customer retention ────────────────────────────────────────────────
  const [thisMonthRecs, prevMonthRecs, beforeMonthRecs] = await Promise.all([
    prisma.groomingRecord.findMany({
      where: { shopId, date: { gte: monthStart, lte: monthEnd } },
      select: { pet: { select: { customerId: true } } },
    }),
    prisma.groomingRecord.findMany({
      where: {
        shopId,
        date: { gte: startOfMonth(subMonths(monthDate, 1)), lte: endOfMonth(subMonths(monthDate, 1)) },
      },
      select: { pet: { select: { customerId: true } } },
    }),
    // M13: previously `date: { lt: monthStart }` with no lower bound pulled the
    // store's ENTIRE grooming history into memory. Bound it to a 12-month
    // lookback window and de-dup by pet so "new customer" = no visit in the prior
    // 12 months (a windowed, explainable definition) instead of an unbounded scan.
    prisma.groomingRecord.findMany({
      where: { shopId, date: { gte: subMonths(monthStart, 12), lt: monthStart } },
      select: { petId: true, pet: { select: { customerId: true } } },
      distinct: ["petId"],
    }),
  ])

  const thisMonthIds = new Set(thisMonthRecs.map((r) => r.pet.customerId))
  const prevMonthIds = new Set(prevMonthRecs.map((r) => r.pet.customerId))
  const beforeIds = new Set(beforeMonthRecs.map((r) => r.pet.customerId))

  const newCount = [...thisMonthIds].filter((id) => !beforeIds.has(id)).length
  const returningCount = [...thisMonthIds].filter((id) => prevMonthIds.has(id)).length
  const customerRetention = {
    totalCount: thisMonthIds.size,
    newCount,
    returningCount,
    returnRate: thisMonthIds.size > 0 ? Math.round((returningCount / thisMonthIds.size) * 100) : 0,
  }

  // ── 16c: Weekday appointment heatmap (this month's appointments) ───────────
  const monthAppointments = await prisma.appointment.findMany({
    where: {
      shopId,
      scheduledAt: { gte: monthStart, lte: monthEnd },
      status: { notIn: ["CANCELLED"] },
    },
    select: { scheduledAt: true },
  })

  const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"]
  const weekdayCounts = Array(7).fill(0)
  for (const apt of monthAppointments) {
    weekdayCounts[new Date(apt.scheduledAt).getDay()]++
  }
  const weekdayAppointments = DAY_NAMES.map((day, i) => ({ day, count: weekdayCounts[i] }))

  // ── J3: Expense P&L data ────────────────────────────────────────────────────
  const [monthExpenseAgg, expenseByCategoryRaw, monthlyExpense] = await Promise.all([
    prisma.expense.aggregate({
      where: { shopId, date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),

    prisma.expense.groupBy({
      by: ["category"],
      where: { shopId, date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),

    Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(monthDate, 5 - i)
        const s = startOfMonth(d)
        const e = endOfMonth(d)
        return prisma.expense
          .aggregate({
            where: { shopId, date: { gte: s, lte: e } },
            _sum: { amount: true },
          })
          .then((r) => ({ month: format(d, "M月"), expense: r._sum.amount ?? 0 }))
      })
    ),
  ])

  const monthExpense = monthExpenseAgg._sum.amount ?? 0
  const expenseByCategory = expenseByCategoryRaw.map((r) => ({
    category: r.category,
    amount: r._sum.amount ?? 0,
  }))

  // Merge monthlyRevenue + monthlyExpense into one array
  const monthlyProfit = monthlyRevenue.map((r, i) => ({
    month: r.month,
    revenue: r.revenue,
    expense: monthlyExpense[i]?.expense ?? 0,
  }))

  // M1: net monthly revenue (sum amount - sum refundedAmount).
  const monthRevenueNet = round2(
    (monthRevenue._sum.amount ?? 0) - (monthRevenue._sum.refundedAmount ?? 0)
  )

  return NextResponse.json({
    monthRevenue: monthRevenueNet,
    monthCount: monthRevenue._count,
    boardingRevenue,
    boardingCount,
    monthlyRevenue,
    paymentMethods,
    serviceStats,
    dailyRevenue,
    staffStats,
    customerRetention,
    weekdayAppointments,
    monthExpense,
    netProfit: round2(monthRevenueNet - monthExpense),
    expenseByCategory,
    monthlyProfit,
  })
  } catch (error) {
    console.error("GET /api/reports", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
