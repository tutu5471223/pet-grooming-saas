import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  subMonths,
  format,
  eachDayOfInterval,
  parseISO,
} from "date-fns"
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  Scissors,
  Users,
  UserPlus,
  UserCheck,
  BarChart2,
  Home,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClickableDailyRevenueChart } from "@/components/dashboard/clickable-daily-revenue-chart"
import { ClickableMonthlyRevenueChart } from "@/components/dashboard/clickable-monthly-revenue-chart"
import { WeekdayChart } from "@/components/dashboard/weekday-chart"
import { ExpenseCategoryChart } from "@/components/dashboard/expense-category-chart"
import { ProfitTrendChart } from "@/components/dashboard/profit-trend-chart"
import { MonthNavigator } from "./month-navigator"
import { CollectButton } from "./collect-button"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "現金",
  CARD: "刷卡",
  TRANSFER: "轉帳",
  LINE_PAY: "LINE Pay",
}

const BILLING_TYPE_LABELS: Record<string, string> = {
  SINGLE: "單次",
  MONTHLY_PLAN: "包月方案",
  NEW_MONTHLY_PLAN: "新包月",
  CREDIT: "儲值金",
}

function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(d: Date) {
  return `${d.getFullYear()}年 ${String(d.getMonth() + 1).padStart(2, "0")}月`
}

// ─── Overview (Tab 1) data ────────────────────────────────────────────────────
async function getOverviewData(shopId: string, monthDate: Date) {
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const now = new Date()
  const effectiveEnd = monthEnd > now ? now : monthEnd

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
      where: { shopId, status: "PAID", paidAt: { gte: monthStart, lte: monthEnd }, boardingRecordId: { not: null } },
      _sum: { amount: true },
      _count: true,
    }),
    Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(monthDate, 5 - i)
        const s = startOfMonth(d)
        const e = endOfMonth(d)
        return prisma.payment
          .aggregate({ where: { shopId, status: "PAID", paidAt: { gte: s, lte: e } }, _sum: { amount: true } })
          .then((r) => ({ month: format(d, "M月"), monthKey: format(d, "yyyy-MM"), revenue: r._sum.amount ?? 0 }))
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
      eachDayOfInterval({ start: monthStart, end: effectiveEnd }).map((d) => {
        const isToday = format(d, "yyyy-MM-dd") === format(now, "yyyy-MM-dd")
        return prisma.payment
          .aggregate({
            where: { shopId, status: "PAID", paidAt: { gte: startOfDay(d), lte: isToday ? now : endOfDay(d) } },
            _sum: { amount: true },
          })
          .then((r) => ({ day: format(d, "d"), revenue: r._sum.amount ?? 0 }))
      })
    ),
  ])

  const serviceMap = new Map<string, { count: number; revenue: number }>()
  for (const record of topServices) {
    try {
      const svcs = JSON.parse(record.services) as { name: string; price: number }[]
      for (const svc of svcs) {
        const prev = serviceMap.get(svc.name) ?? { count: 0, revenue: 0 }
        serviceMap.set(svc.name, { count: prev.count + 1, revenue: prev.revenue + svc.price })
      }
    } catch {}
  }

  const boardingRevenue = boardingRevenueStat._sum.amount ?? 0
  const boardingCount = boardingRevenueStat._count
  const serviceStatsRaw = Array.from(serviceMap.entries())
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
  const serviceStats = boardingRevenue > 0
    ? [...serviceStatsRaw, { name: "住宿費", count: boardingCount, revenue: boardingRevenue }].sort((a, b) => b.revenue - a.revenue).slice(0, 9)
    : serviceStatsRaw

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
    .map(([groomerId, s]) => ({ groomerId, groomerName: s.name, count: s.count, revenue: s.revenue, avg: s.count > 0 ? Math.round(s.revenue / s.count) : 0 }))
    .sort((a, b) => b.revenue - a.revenue)

  const [thisMonthRecs, prevMonthRecs, beforeMonthRecs] = await Promise.all([
    prisma.groomingRecord.findMany({ where: { shopId, date: { gte: monthStart, lte: monthEnd } }, select: { pet: { select: { customerId: true } } } }),
    prisma.groomingRecord.findMany({ where: { shopId, date: { gte: startOfMonth(subMonths(monthDate, 1)), lte: endOfMonth(subMonths(monthDate, 1)) } }, select: { pet: { select: { customerId: true } } } }),
    prisma.groomingRecord.findMany({ where: { shopId, date: { lt: monthStart } }, select: { pet: { select: { customerId: true } } } }),
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

  const monthAppointments = await prisma.appointment.findMany({
    where: { shopId, scheduledAt: { gte: monthStart, lte: monthEnd }, status: { notIn: ["CANCELLED"] } },
    select: { scheduledAt: true },
  })
  const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"]
  const weekdayCounts = Array(7).fill(0)
  for (const apt of monthAppointments) weekdayCounts[new Date(apt.scheduledAt).getDay()]++
  const weekdayAppointments = DAY_NAMES.map((day, i) => ({ day, count: weekdayCounts[i] }))

  const [monthExpenseAgg, expenseByCategoryRaw, monthlyExpense] = await Promise.all([
    prisma.expense.aggregate({ where: { shopId, date: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ["category"], where: { shopId, date: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
    Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(monthDate, 5 - i)
        const s = startOfMonth(d)
        const e = endOfMonth(d)
        return prisma.expense
          .aggregate({ where: { shopId, date: { gte: s, lte: e } }, _sum: { amount: true } })
          .then((r) => ({ month: format(d, "M月"), expense: r._sum.amount ?? 0 }))
      })
    ),
  ])

  const monthExpense = monthExpenseAgg._sum.amount ?? 0
  const monthRevenueTotal = monthRevenue._sum.amount ?? 0

  return {
    monthRevenue: monthRevenueTotal,
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
    netProfit: monthRevenueTotal - monthExpense,
    expenseByCategory: expenseByCategoryRaw.map((r) => ({ category: r.category, amount: r._sum.amount ?? 0 })),
    monthlyProfit: monthlyRevenue.map((r, i) => ({ month: r.month, revenue: r.revenue, expense: monthlyExpense[i]?.expense ?? 0 })),
  }
}

// ─── Income (Tab 2) data ──────────────────────────────────────────────────────
async function getIncomeData(shopId: string, fromDate: Date, toDate: Date) {
  const [payments, sales] = await Promise.all([
    prisma.payment.findMany({
      where: { shopId, status: "PAID", paidAt: { gte: fromDate, lte: toDate } },
      include: {
        groomingRecord: {
          select: {
            services: true,
            pet: { select: { name: true, customer: { select: { name: true } } } },
          },
        },
        boardingRecord: {
          select: { pet: { select: { name: true, customer: { select: { name: true } } } } },
        },
        customer: { select: { name: true } },
      },
      orderBy: { paidAt: "desc" },
    }),
    prisma.sale.findMany({
      where: { shopId, createdAt: { gte: fromDate, lte: toDate } },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  type IncomeRow = {
    id: string
    date: Date
    type: string
    petOrItem: string
    customer: string
    amount: number
    billingType: string
    paymentMethod: string
  }

  const rows: IncomeRow[] = []

  for (const p of payments) {
    let type = "其他"
    if (p.groomingRecord) type = "美容"
    else if (p.boardingRecord) type = "住宿"
    const petName = p.groomingRecord?.pet?.name ?? p.boardingRecord?.pet?.name ?? "—"
    const customerName = p.groomingRecord?.pet?.customer?.name ?? p.boardingRecord?.pet?.customer?.name ?? p.customer?.name ?? "—"
    rows.push({
      id: p.id,
      date: new Date(p.paidAt!),
      type,
      petOrItem: petName,
      customer: customerName,
      amount: p.amount,
      billingType: BILLING_TYPE_LABELS[p.billingType] ?? p.billingType,
      paymentMethod: PAYMENT_METHOD_LABELS[p.paymentMethod ?? ""] ?? p.paymentMethod ?? "—",
    })
  }
  for (const s of sales) {
    const items = s.items.map((i) => i.product.name).join("、") || "商品"
    rows.push({ id: s.id, date: new Date(s.createdAt), type: "商品銷售", petOrItem: items, customer: s.customer?.name ?? "—", amount: s.total, billingType: "—", paymentMethod: "—" })
  }

  rows.sort((a, b) => b.date.getTime() - a.date.getTime())
  const total = rows.reduce((s, r) => s + r.amount, 0)
  return { rows, total }
}

// ─── Expense (Tab 3) data ─────────────────────────────────────────────────────
async function getExpenseData(shopId: string, fromDate: Date, toDate: Date) {
  const expenses = await prisma.expense.findMany({
    where: { shopId, date: { gte: fromDate, lte: toDate } },
    include: { creator: { select: { name: true } } },
    orderBy: { date: "desc" },
  })
  const total = expenses.reduce((s, e) => s + e.amount, 0)
  return { expenses, total }
}

// ─── Receivables (Tab 4) data ─────────────────────────────────────────────────
async function getReceivablesData(shopId: string) {
  const pendingPayments = await prisma.payment.findMany({
    where: { shopId, status: "PENDING" },
    include: {
      groomingRecord: {
        select: {
          date: true,
          services: true,
          pet: { select: { name: true, customer: { select: { name: true } } } },
        },
      },
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  const total = pendingPayments.reduce((s, p) => s + p.amount, 0)
  return { pendingPayments, total }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tab?: string; from?: string; to?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const shopId = session.user.shopId
  const { month: monthParam, tab: tabParam, from: fromParam, to: toParam } = await searchParams

  let monthDate: Date
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number)
    monthDate = new Date(y, m - 1, 1)
  } else {
    monthDate = new Date()
  }

  const month = toMonthStr(monthDate)
  const tab = tabParam ?? "overview"

  const fromDate = fromParam ? startOfDay(parseISO(fromParam)) : startOfMonth(monthDate)
  const toDate = toParam ? endOfDay(parseISO(toParam)) : endOfMonth(monthDate)
  const hasDateFilter = !!(fromParam && toParam)

  const overviewData = tab === "overview" ? await getOverviewData(shopId, monthDate) : null
  const incomeData = tab === "income" ? await getIncomeData(shopId, fromDate, toDate) : null
  const expenseData = tab === "expense" ? await getExpenseData(shopId, fromDate, toDate) : null
  const receivablesData = tab === "receivables" ? await getReceivablesData(shopId) : null

  const TABS = [
    { id: "overview", label: "營收總覽" },
    { id: "income", label: "收入明細" },
    { id: "expense", label: "支出明細" },
    { id: "receivables", label: "應收帳款" },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">營收報表</h1>
            {tab !== "receivables" && (
              <p className="text-sm text-gray-500 mt-1">{monthLabel(monthDate)}</p>
            )}
          </div>
          {tab !== "receivables" && <MonthNavigator month={month} tab={tab} />}
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/reports?tab=${t.id}&month=${month}`}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Date filter banner (tabs 2 & 3 when from/to set) */}
      {hasDateFilter && (tab === "income" || tab === "expense") && (
        <div className="flex items-center gap-3 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-2.5">
          <AlertCircle className="h-4 w-4 text-indigo-600 shrink-0" />
          <span className="text-sm text-indigo-800">
            篩選日期：{fromParam} ～ {toParam}
          </span>
          <Link
            href={`/reports?tab=${tab}&month=${month}`}
            className="ml-auto text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            清除篩選
          </Link>
        </div>
      )}

      {/* ── Tab 1: Overview ─────────────────────────────────────────────────── */}
      {tab === "overview" && overviewData && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-500">本月總收入</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(overviewData.monthRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-gray-500">本月支出</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(overviewData.monthExpense)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm ${overviewData.netProfit >= 0 ? "text-indigo-500" : "text-orange-500"}`}>本月淨利</span>
                </div>
                <p className={`text-2xl font-bold ${overviewData.netProfit >= 0 ? "text-indigo-700" : "text-orange-700"}`}>
                  {overviewData.netProfit >= 0 ? "+" : ""}{formatCurrency(overviewData.netProfit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Scissors className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-gray-500">美容平均客單</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {overviewData.monthCount > 0
                    ? formatCurrency((overviewData.monthRevenue - overviewData.boardingRevenue) / Math.max(1, overviewData.monthCount - overviewData.boardingCount))
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue trend + payment methods */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">近6個月收入趨勢</CardTitle></CardHeader>
              <CardContent>
                <ClickableMonthlyRevenueChart data={overviewData.monthlyRevenue} currentMonth={month} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">本月付款方式</CardTitle></CardHeader>
              <CardContent>
                {overviewData.paymentMethods.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-sm">本月無收入資料</div>
                ) : (
                  <div className="space-y-3">
                    {overviewData.paymentMethods.map((m) => {
                      const key = m.paymentMethod ?? "—"
                      const pct = overviewData.monthRevenue > 0
                        ? (((m._sum.amount ?? 0) / overviewData.monthRevenue) * 100).toFixed(1)
                        : "0"
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-700">{PAYMENT_METHOD_LABELS[key] ?? key}（{m._count} 筆）</span>
                            <span className="font-medium text-gray-900">{formatCurrency(m._sum.amount ?? 0)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100">
                            <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Daily revenue (clickable) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">本月每日收入</CardTitle>
              <p className="text-xs text-gray-400">點擊柱狀圖可查看當日收入明細</p>
            </CardHeader>
            <CardContent>
              <ClickableDailyRevenueChart data={overviewData.dailyRevenue} month={month} />
            </CardContent>
          </Card>

          {/* Service stats */}
          <Card>
            <CardHeader><CardTitle className="text-base">本月服務項目業績</CardTitle></CardHeader>
            <CardContent>
              {overviewData.serviceStats.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">本月無美容紀錄</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100">
                    <tr>
                      <th className="pb-2 text-left font-medium text-gray-500">服務項目</th>
                      <th className="pb-2 text-right font-medium text-gray-500">次數</th>
                      <th className="pb-2 text-right font-medium text-gray-500">收入</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {overviewData.serviceStats.map((svc) => (
                      <tr key={svc.name}>
                        <td className="py-2.5 text-gray-900">{svc.name}</td>
                        <td className="py-2.5 text-right text-gray-700">{svc.count} 次</td>
                        <td className="py-2.5 text-right font-medium text-gray-900">{formatCurrency(svc.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Staff performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />員工業績統計
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overviewData.staffStats.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">本月無指定美容師的紀錄</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100">
                    <tr>
                      <th className="pb-2 text-left font-medium text-gray-500">員工</th>
                      <th className="pb-2 text-right font-medium text-gray-500">美容筆數</th>
                      <th className="pb-2 text-right font-medium text-gray-500">業績金額</th>
                      <th className="pb-2 text-right font-medium text-gray-500">平均客單</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {overviewData.staffStats.map((s) => (
                      <tr key={s.groomerId}>
                        <td className="py-2.5 font-medium text-gray-900">{s.groomerName}</td>
                        <td className="py-2.5 text-right text-gray-700">{s.count} 筆</td>
                        <td className="py-2.5 text-right font-medium text-gray-900">{formatCurrency(s.revenue)}</td>
                        <td className="py-2.5 text-right text-gray-700">{formatCurrency(s.avg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Expense + profit trend */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-purple-500" />支出分類佔比
                </CardTitle>
              </CardHeader>
              <CardContent><ExpenseCategoryChart data={overviewData.expenseByCategory} /></CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-indigo-500" />近6個月損益趨勢
                </CardTitle>
              </CardHeader>
              <CardContent><ProfitTrendChart data={overviewData.monthlyProfit} /></CardContent>
            </Card>
          </div>

          {/* Customer retention + weekday */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-green-500" />客戶回流分析
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overviewData.customerRetention.totalCount === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-sm">本月無到店客戶</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-blue-50 p-4 text-center">
                        <p className="text-2xl font-bold text-blue-700">{overviewData.customerRetention.totalCount}</p>
                        <p className="text-xs text-blue-600 mt-1">本月到店</p>
                      </div>
                      <div className="rounded-xl bg-green-50 p-4 text-center">
                        <p className="text-2xl font-bold text-green-700">{overviewData.customerRetention.newCount}</p>
                        <p className="text-xs text-green-600 mt-1 flex items-center justify-center gap-1">
                          <UserPlus className="h-3 w-3" />新客
                        </p>
                      </div>
                      <div className="rounded-xl bg-purple-50 p-4 text-center">
                        <p className="text-2xl font-bold text-purple-700">{overviewData.customerRetention.returningCount}</p>
                        <p className="text-xs text-purple-600 mt-1">回流客</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">回流率</span>
                        <span className="font-bold text-indigo-700">{overviewData.customerRetention.returnRate}%</span>
                      </div>
                      <div className="h-3 rounded-full bg-gray-100">
                        <div className="h-3 rounded-full bg-indigo-500 transition-all" style={{ width: `${overviewData.customerRetention.returnRate}%` }} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">回流客：本月有到店且上個月也有到店的客人</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-orange-500" />熱門預約時段（本月各週）
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overviewData.weekdayAppointments.every((d) => d.count === 0) ? (
                  <div className="py-8 text-center text-gray-400 text-sm">本月無預約資料</div>
                ) : (
                  <>
                    <WeekdayChart data={overviewData.weekdayAppointments} />
                    <p className="text-xs text-gray-400 text-center mt-1">本月各星期預約筆數</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Tab 2: Income ────────────────────────────────────────────────────── */}
      {tab === "income" && incomeData && (
        <div className="space-y-4">
          {incomeData.rows.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-gray-400">
                <Receipt className="h-10 w-10 mx-auto mb-2" />
                <p>此期間無收入紀錄</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">日期</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">類型</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">項目/寵物</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">客人</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">計費方式</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">付款方式</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">金額</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {incomeData.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{format(row.date, "MM/dd")}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{row.type}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-900 max-w-[160px] truncate">{row.petOrItem}</td>
                          <td className="px-4 py-3 text-gray-700">{row.customer}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{row.billingType}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{row.paymentMethod}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-gray-200 bg-gray-50">
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-gray-700">合計（{incomeData.rows.length} 筆）</td>
                        <td className="px-4 py-3 text-right text-base font-bold text-indigo-700">{formatCurrency(incomeData.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Tab 3: Expense ───────────────────────────────────────────────────── */}
      {tab === "expense" && expenseData && (
        <div className="space-y-4">
          {expenseData.expenses.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-gray-400">
                <TrendingDown className="h-10 w-10 mx-auto mb-2" />
                <p>此期間無支出紀錄</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">日期</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">類別</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">說明</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">經手人</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">金額</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {expenseData.expenses.map((e) => (
                        <tr key={e.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{format(new Date(e.date), "MM/dd")}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">{e.category}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-900">{e.description}</td>
                          <td className="px-4 py-3 text-gray-500">{e.creator?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-gray-200 bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">合計（{expenseData.expenses.length} 筆）</td>
                        <td className="px-4 py-3 text-right text-base font-bold text-red-700">{formatCurrency(expenseData.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Tab 4: Receivables ───────────────────────────────────────────────── */}
      {tab === "receivables" && receivablesData && (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Home className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-gray-500">未收款筆數</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{receivablesData.pendingPayments.length} 筆</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpRight className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-gray-500">未收款總額</span>
                </div>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(receivablesData.total)}</p>
              </CardContent>
            </Card>
          </div>

          {receivablesData.pendingPayments.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-gray-400">
                <ArrowDownRight className="h-10 w-10 mx-auto mb-2 text-green-400" />
                <p className="text-green-600 font-medium">所有款項皆已收清！</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">日期</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">客人</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">寵物</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">項目</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">金額</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {receivablesData.pendingPayments.map((p) => {
                        const rec = p.groomingRecord
                        const services = rec ? (() => { try { return (JSON.parse(rec.services) as { name: string }[]).map(s => s.name).join("、") } catch { return "" } })() : ""
                        return (
                          <tr key={p.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              {rec ? format(new Date(rec.date), "MM/dd") : "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-900">{rec?.pet?.customer?.name ?? p.customer?.name ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-700">{rec?.pet?.name ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{services || "美容"}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(p.amount)}</td>
                            <td className="px-4 py-3">
                              <CollectButton paymentId={p.id} amount={p.amount} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="border-t border-gray-200 bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">未收款合計</td>
                        <td className="px-4 py-3 text-right text-base font-bold text-red-700">{formatCurrency(receivablesData.total)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
