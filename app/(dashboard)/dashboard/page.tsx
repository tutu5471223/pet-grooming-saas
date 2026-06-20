import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatCurrency, appointmentStatusLabel } from "@/lib/utils"
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, format } from "date-fns"
import Link from "next/link"
import {
  Users,
  Calendar,
  Home,
  TrendingUp,
  Clock,
  PawPrint,
  ChevronRight,
  Plus,
  UserPlus,
  BarChart3,
  ShoppingBag,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RevenueChart } from "@/components/dashboard/revenue-chart"

async function getDashboardData(shopId: string) {
  const today = new Date()
  const todayStart = startOfDay(today)
  const todayEnd = endOfDay(today)
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  const [todayAppointments, stayingPets, monthRevenue, totalCustomers, monthlyRevenue, todaySales, lowStockProducts] =
    await Promise.all([
      prisma.appointment.findMany({
        where: { shopId, scheduledAt: { gte: todayStart, lte: todayEnd } },
        include: { pet: { include: { customer: true } }, staff: true },
        orderBy: { scheduledAt: "asc" },
      }),
      prisma.boardingRecord.findMany({
        where: { shopId, status: "STAYING" },
        include: { pet: { include: { customer: true } }, room: true },
        orderBy: { checkIn: "asc" },
      }),
      prisma.payment.aggregate({
        where: { shopId, status: "PAID", paidAt: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.customer.count({ where: { shopId } }),
      Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const d = subMonths(today, 5 - i)
          const s = startOfMonth(d)
          const e = endOfMonth(d)
          return prisma.payment
            .aggregate({
              where: { shopId, status: "PAID", paidAt: { gte: s, lte: e } },
              _sum: { amount: true },
            })
            .then((r) => ({
              month: format(d, "M月"),
              yearMonth: format(d, "yyyy-MM"),
              revenue: r._sum.amount ?? 0,
            }))
        })
      ),
      prisma.sale.aggregate({
        where: { shopId, createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { total: true },
      }),
      prisma.product.findMany({
        where: { shopId, isActive: true, stock: { lte: 5 } },
        select: { id: true, name: true, stock: true },
        orderBy: { stock: "asc" },
      }),
    ])

  return {
    todayAppointments,
    stayingPets,
    monthRevenue: monthRevenue._sum.amount ?? 0,
    totalCustomers,
    monthlyRevenue,
    todaySalesTotal: todaySales._sum.total ?? 0,
    lowStockProducts,
  }
}

export default async function DashboardPage() {
  const session = await auth()
  const shopId = session!.user.shopId
  const data = await getDashboardData(shopId)
  const today = new Date()

  const stats = [
    {
      title: "今日預約",
      value: data.todayAppointments.length,
      unit: "筆",
      icon: Calendar,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "住宿中寵物",
      value: data.stayingPets.length,
      unit: "隻",
      icon: Home,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "本月收入",
      value: formatCurrency(data.monthRevenue),
      unit: "",
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "今日銷售",
      value: formatCurrency(data.todaySalesTotal),
      unit: "",
      icon: ShoppingBag,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      title: "總客人數",
      value: data.totalCustomers,
      unit: "位",
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">儀表板</h1>
        <p className="text-sm text-gray-500 mt-1">
          {format(today, "yyyy年 MM月 dd日")}・{session?.user.shopName}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/appointments?new=1", icon: Plus, label: "新增預約", color: "bg-indigo-600 hover:bg-indigo-700 text-white" },
          { href: "/customers?new=1", icon: UserPlus, label: "新增客人", color: "bg-white hover:bg-gray-50 text-gray-900 border border-gray-200" },
          { href: "/appointments?view=week", icon: Calendar, label: "週視圖行事曆", color: "bg-white hover:bg-gray-50 text-gray-900 border border-gray-200" },
          { href: "/reports", icon: BarChart3, label: "查看報表", color: "bg-white hover:bg-gray-50 text-gray-900 border border-gray-200" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${action.color}`}
          >
            <action.icon className="h-4 w-4 shrink-0" />
            {action.label}
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {stat.value}
                    {stat.unit && (
                      <span className="text-base font-normal text-gray-500 ml-1">
                        {stat.unit}
                      </span>
                    )}
                  </p>
                </div>
                <div className={`rounded-xl p-2.5 ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        {/* Revenue chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">近6個月收入</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={data.monthlyRevenue} />
          </CardContent>
        </Card>

        {/* Staying pets */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">住宿中寵物</CardTitle>
            <Link
              href="/boarding"
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
            >
              查看全部 <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.stayingPets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Home className="h-8 w-8 mb-2" />
                <p className="text-sm">目前無住宿寵物</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.stayingPets.slice(0, 5).map((record) => (
                  <li key={record.id} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 shrink-0">
                      <PawPrint className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {record.pet.name}
                        <span className="ml-1 text-xs text-gray-500">
                          ({record.pet.customer.name})
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {record.room?.name ?? "未分配"} ·{" "}
                        {formatCurrency(record.dailyRate)}/天
                      </p>
                    </div>
                    <Badge variant="success" className="shrink-0 text-xs">
                      住宿中
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low stock warning */}
      {data.lowStockProducts.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-4 w-4" />
              庫存警示（庫存 ≤ 5）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.lowStockProducts.map((p) => (
                <Link
                  key={p.id}
                  href="/products"
                  className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm text-orange-800 hover:bg-orange-100 transition-colors"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-orange-600">剩 {p.stock} 件</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today appointments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">今日預約</CardTitle>
          <Link
            href="/appointments"
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
          >
            查看全部 <ChevronRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.todayAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Calendar className="h-10 w-10 mb-2" />
              <p className="text-sm">今日無預約</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 text-left font-medium text-gray-500">時間</th>
                    <th className="pb-3 text-left font-medium text-gray-500">寵物 / 客人</th>
                    <th className="pb-3 text-left font-medium text-gray-500">服務</th>
                    <th className="pb-3 text-left font-medium text-gray-500">美容師</th>
                    <th className="pb-3 text-left font-medium text-gray-500">狀態</th>
                    <th className="pb-3 text-right font-medium text-gray-500">費用</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.todayAppointments.map((apt) => {
                    const statusInfo = appointmentStatusLabel(apt.status)
                    const services = apt.services
                      ? (() => { try { return JSON.parse(apt.services) as { name: string }[] } catch { return [] } })()
                      : []
                    return (
                      <tr key={apt.id} className="hover:bg-gray-50/50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span className="font-medium text-gray-900">
                              {format(new Date(apt.scheduledAt), "HH:mm")}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <p className="font-medium text-gray-900">{apt.pet.name}</p>
                          <p className="text-xs text-gray-500">{apt.pet.customer.name}</p>
                        </td>
                        <td className="py-3 pr-4 text-gray-700">
                          {services.length > 0
                            ? services.map((s) => s.name).join("、")
                            : apt.type === "GROOMING"
                            ? "美容"
                            : apt.type === "BOARDING"
                            ? "住宿"
                            : "諮詢"}
                        </td>
                        <td className="py-3 pr-4 text-gray-700">{apt.staff?.name ?? "—"}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="py-3 text-right font-medium text-gray-900">
                          {apt.estimatedCost ? formatCurrency(apt.estimatedCost) : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
