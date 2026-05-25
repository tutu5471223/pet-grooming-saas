"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Building2, Search, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface Shop {
  id: string
  name: string
  phone: string | null
  createdAt: string
  _count: { customers: number; users: number }
  subscriptions: Array<{
    status: string
    currentPeriodEnd: string
    plan: { name: string; price: number }
  }>
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TRIAL: { label: "試用中", color: "bg-blue-100 text-blue-700" },
  ACTIVE: { label: "訂閱中", color: "bg-green-100 text-green-700" },
  PAST_DUE: { label: "逾期", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "已取消", color: "bg-gray-100 text-gray-700" },
}

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch("/api/admin/shops")
      .then((r) => r.json())
      .then((d) => { setShops(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = shops.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">店家管理</h1>
        <p className="text-sm text-gray-500 mt-1">共 {shops.length} 家店家</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> 所有店家
          </CardTitle>
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9 h-8 text-sm"
              placeholder="搜尋店家名稱或 ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-100" />)}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-3 text-left font-medium text-gray-500">店家名稱</th>
                  <th className="pb-3 text-left font-medium text-gray-500">ID</th>
                  <th className="pb-3 text-left font-medium text-gray-500">方案</th>
                  <th className="pb-3 text-left font-medium text-gray-500">狀態</th>
                  <th className="pb-3 text-left font-medium text-gray-500">到期日</th>
                  <th className="pb-3 text-right font-medium text-gray-500">客人</th>
                  <th className="pb-3 text-right font-medium text-gray-500">員工</th>
                  <th className="pb-3 text-right font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((shop) => {
                  const sub = shop.subscriptions[0]
                  const statusInfo = sub ? (STATUS_LABELS[sub.status] ?? { label: sub.status, color: "bg-gray-100 text-gray-700" }) : null
                  return (
                    <tr key={shop.id} className="hover:bg-gray-50/50">
                      <td className="py-3 pr-4 font-medium text-gray-900">{shop.name}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-gray-500">{shop.id}</td>
                      <td className="py-3 pr-4 text-gray-700">{sub?.plan.name ?? "—"}</td>
                      <td className="py-3 pr-4">
                        {statusInfo ? (
                          <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-gray-500 text-xs">
                        {sub ? format(new Date(sub.currentPeriodEnd), "yyyy/MM/dd") : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-700">{shop._count.customers}</td>
                      <td className="py-3 pr-4 text-right text-gray-700">{shop._count.users}</td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/admin/shops/${shop.id}`}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                        >
                          詳情 <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
