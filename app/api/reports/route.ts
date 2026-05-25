// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  subMonths,
  subDays,
  format,
  eachDayOfInterval,
} from "date-fns"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
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
    paymentMethods,
    topServices,
    dailyRevenue,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { shopId, status: "PAID", paidAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
      _count: true,
    }),

    prisma.payment.aggregate({
      where: {
        shopId,
        status: "PAID",
        paidAt: { gte: monthStart, lte: monthEnd },
        boardingRecordId: { not: null },
      },
      _sum: { amount: true },
      _count: true,
    }),

    Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(monthDate, 5 - i)
        const s = startOfMonth(d)
        const e = endOfMonth(d)
        return prisma.payment
          .aggregate({
            where: { shopId, status: "PAID", paidAt: { gte: s, lte: e } },
            _sum: { amount: true },
          })
          .then((r) => ({ month: format(d, "M月"), revenue: r._sum.amount ?? 0 }))
      })
    ),

    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: { shopId, status: "PAID", paidAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
      _count: true,
    }),

    prisma.groomingRecord.findMany({
      where: { shopId, date: { gte: monthStart, lte: monthEnd } },
      select: { services: true, totalCost: true },
    }),

    Promise.all(
      eachDayOfInterval({ start: monthStart, end: effectiveEnd }).map((d) =>
        prisma.payment
          .aggregate({
            where: {
              shopId,
              status: "PAID",
              paidAt: { gte: startOfDay(d), lte: endOfDay(d) },
            },
            _sum: { amount: true },
          })
          .then((r) => ({ day: format(d, "d"), revenue: r._sum.amount ?? 0 }))
      )
    ),
  ])

  // ── Service stats ──────────────────────────────────────────────────────────
  const serviceMap = new Map<string, { count: number; revenue: number }>()
  for (const record of topServices) {
    const svcs = JSON.parse(record.services) as { name: string; price: number }[]
    for (const svc of svcs) {
      const prev = serviceMap.get(svc.name) ?? { count: 0, revenue: 0 }
      serviceMap.set(svc.name, { count: prev.count + 1, revenue: prev.revenue + svc.price })
    }
  }
  const boardingRevenue = boardingRevenueStat._sum.amount ?? 0
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
    prisma.groomingRecord.findMany({
      where: { shopId, date: { lt: monthStart } },
      select: { pet: { select: { customerId: true } } },
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

  return NextResponse.json({
    monthRevenue: monthRevenue._sum.amount ?? 0,
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
    netProfit: (monthRevenue._sum.amount ?? 0) - monthExpense,
    expenseByCategory,
    monthlyProfit,
  })
  } catch (error) {
    console.error("GET /api/reports", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
