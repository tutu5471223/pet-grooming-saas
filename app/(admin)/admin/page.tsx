import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth, format } from "date-fns"
import { Building2, Users, CreditCard, TrendingUp, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TRIAL: { label: "試用中", color: "bg-blue-100 text-blue-700" },
  ACTIVE: { label: "訂閱中", color: "bg-green-100 text-green-700" },
  PAST_DUE: { label: "逾期", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "已取消", color: "bg-gray-100 text-gray-700" },
}

async function getStats() {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const [totalShops, newShops, totalCustomers, activeSubs, trialSubs, recentShops] = await Promise.all([
    prisma.shop.count(),
    prisma.shop.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.customer.count(),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "TRIAL" } }),
    prisma.shop.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { customers: true } },
      },
    }),
  ])

  return { totalShops, newShops, totalCustomers, activeSubs, trialSubs, recentShops }
}

export default async function AdminPage() {
  const session = await auth()
  const stats = await getStats()

  const statCards = [
    { title: "總店家數", value: stats.totalShops, unit: "家", icon: Building2, color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "本月新增", value: stats.newShops, unit: "家", icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { title: "訂閱中", value: stats.activeSubs, unit: "家", icon: CreditCard, color: "text-purple-600", bg: "bg-purple-50" },
    { title: "試用中", value: stats.trialSubs, unit: "家", icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
    { title: "總客人數", value: stats.totalCustomers, unit: "位", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">平台總覽</h1>
        <p className="text-sm text-gray-500 mt-1">歡迎回來，{session?.user.name}！{format(new Date(), "yyyy年 MM月 dd日")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {statCards.map((s) => (
          <Card key={s.title}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">{s.title}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {s.value}
                    <span className="text-sm font-normal text-gray-500 ml-1">{s.unit}</span>
                  </p>
                </div>
                <div className={`rounded-lg p-2 ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">最新加入店家</CardTitle>
          <Link href="/admin/shops" className="text-xs text-indigo-600 hover:text-indigo-700">查看全部</Link>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-3 text-left font-medium text-gray-500">店家</th>
                <th className="pb-3 text-left font-medium text-gray-500">ID</th>
                <th className="pb-3 text-left font-medium text-gray-500">訂閱</th>
                <th className="pb-3 text-left font-medium text-gray-500">到期日</th>
                <th className="pb-3 text-right font-medium text-gray-500">客人數</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.recentShops.map((shop) => {
                const sub = shop.subscriptions[0]
                const statusInfo = sub ? (STATUS_LABELS[sub.status] ?? { label: sub.status, color: "bg-gray-100 text-gray-700" }) : null
                return (
                  <tr key={shop.id} className="hover:bg-gray-50/50">
                    <td className="py-3 pr-4 font-medium text-gray-900">
                      <Link href={`/admin/shops/${shop.id}`} className="hover:text-indigo-600">{shop.name}</Link>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-500">{shop.id}</td>
                    <td className="py-3 pr-4">
                      {statusInfo ? (
                        <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-gray-500 text-xs">
                      {sub ? format(new Date(sub.currentPeriodEnd), "yyyy/MM/dd") : "—"}
                    </td>
                    <td className="py-3 text-right text-gray-700">{shop._count.customers}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
