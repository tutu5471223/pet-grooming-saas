"use client"

import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import {
  Building2, Users, CreditCard, TrendingUp, Calendar, AlertTriangle,
  ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const UNLIMITED = 999999

interface ShopUsage {
  id: string
  name: string
  customerCount: number
  maxCustomers: number
  petCount: number
  totalAppointments: number
  monthlyAppointments: number
  photoCount: number
  subStatus: string | null
  subPlanName: string | null
  currentPeriodEnd: string | null
}

interface StatsData {
  totalShops: number
  newShopsThisMonth: number
  totalCustomers: number
  totalAppointments: number
  activeSubs: number
  trialSubs: number
  monthlyGrowth: { month: string; shops: number }[]
  planStats: { status: string; _count: number }[]
  shopUsage: ShopUsage[]
}

const STATUS_META: Record<string, { label: string; bar: string; badge: string }> = {
  TRIAL:     { label: "試用中", bar: "bg-blue-500",   badge: "bg-blue-100 text-blue-700" },
  ACTIVE:    { label: "訂閱中", bar: "bg-green-500",  badge: "bg-green-100 text-green-700" },
  PAST_DUE:  { label: "逾期",   bar: "bg-red-500",    badge: "bg-red-100 text-red-700" },
  CANCELLED: { label: "已取消", bar: "bg-gray-400",   badge: "bg-gray-100 text-gray-600" },
}

type SortKey = "name" | "customerCount" | "currentPeriodEnd" | "subStatus"
type SortDir = "asc" | "desc"

function MiniBar({ current, max }: { current: number; max: number }) {
  if (max >= UNLIMITED) return <span className="text-xs text-gray-400">無限制</span>
  const pct = Math.min((current / max) * 100, 100)
  const barColor = pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-yellow-400" : "bg-indigo-500"
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className={pct >= 80 ? "font-semibold text-orange-600" : "text-gray-700"}>
          {current} / {max}
        </span>
        <span className={`text-xs ${pct >= 95 ? "text-red-600 font-bold" : pct >= 80 ? "text-yellow-600" : "text-gray-400"}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 w-24 rounded-full bg-gray-100">
        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-300 ml-1 inline" />
  return sortDir === "asc"
    ? <ArrowUp className="h-3.5 w-3.5 text-indigo-500 ml-1 inline" />
    : <ArrowDown className="h-3.5 w-3.5 text-indigo-500 ml-1 inline" />
}

export default function AdminStatsPage() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>("customerCount")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("desc") }
  }

  const sortedUsage = useMemo(() => {
    if (!data) return []
    return [...data.shopUsage].sort((a, b) => {
      let va: string | number = 0
      let vb: string | number = 0
      if (sortKey === "name")           { va = a.name; vb = b.name }
      if (sortKey === "customerCount")  { va = a.customerCount; vb = b.customerCount }
      if (sortKey === "currentPeriodEnd") {
        va = a.currentPeriodEnd ?? ""
        vb = b.currentPeriodEnd ?? ""
      }
      if (sortKey === "subStatus") { va = a.subStatus ?? ""; vb = b.subStatus ?? "" }
      if (va < vb) return sortDir === "asc" ? -1 : 1
      if (va > vb) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }, [data, sortKey, sortDir])

  const nearLimitCount = data?.shopUsage.filter(
    (s) => s.maxCustomers < UNLIMITED && s.customerCount / s.maxCustomers >= 0.8
  ).length ?? 0

  const statCards = [
    { title: "總店家數", value: data?.totalShops ?? 0, icon: Building2, color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "本月新增", value: data?.newShopsThisMonth ?? 0, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { title: "付費訂閱", value: data?.activeSubs ?? 0, icon: CreditCard, color: "text-purple-600", bg: "bg-purple-50" },
    { title: "試用中", value: data?.trialSubs ?? 0, icon: Building2, color: "text-orange-600", bg: "bg-orange-50" },
    { title: "總客人數", value: data?.totalCustomers ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "總預約筆數", value: data?.totalAppointments ?? 0, icon: Calendar, color: "text-teal-600", bg: "bg-teal-50" },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">統計數據</h1>
        <p className="text-sm text-gray-500 mt-1">平台整體運營概況與各店家用量</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {statCards.map((s) => (
          <Card key={s.title}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">{s.title}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{s.value.toLocaleString()}</p>
                </div>
                <div className={`rounded-lg p-2 ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Near-limit warning */}
      {nearLimitCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
          <p className="text-sm font-medium text-orange-800">
            有 <strong>{nearLimitCount}</strong> 間店家的客人數已超過方案上限 80%，請留意是否需要主動提醒升級。
          </p>
        </div>
      )}

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">近6個月新增店家</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2 animate-pulse">{[...Array(6)].map((_, i) => <div key={i} className="h-5 rounded bg-gray-100" />)}</div>
            ) : (
              <div className="space-y-2">
                {data?.monthlyGrowth.map((m) => {
                  const maxVal = Math.max(...(data.monthlyGrowth.map((x) => x.shops)), 1)
                  const pct = ((m.shops / maxVal) * 100).toFixed(0)
                  return (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="w-8 text-xs text-gray-500 text-right shrink-0">{m.month}</span>
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-5 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-5 text-xs font-medium text-gray-700 shrink-0">{m.shops}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">訂閱狀態分布</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-8 rounded bg-gray-100" />)}</div>
            ) : (
              <div className="space-y-3">
                {data?.planStats.map((p) => {
                  const total = data.planStats.reduce((s, x) => s + x._count, 0) || 1
                  const pct = ((p._count / total) * 100).toFixed(1)
                  const meta = STATUS_META[p.status]
                  return (
                    <div key={p.status}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">{meta?.label ?? p.status}</span>
                        <span className="font-medium text-gray-900">{p._count} 家（{pct}%）</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className={`h-2 rounded-full ${meta?.bar ?? "bg-gray-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                {!data?.planStats.length && <p className="text-sm text-gray-400 text-center py-4">尚無訂閱資料</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-shop usage table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">各店家用量詳情</CardTitle>
          <span className="text-xs text-gray-400">點擊欄位標題排序 · 紅底 = 超過用量 80%</span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-100" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 text-left font-medium text-gray-500 cursor-pointer select-none" onClick={() => toggleSort("name")}>
                      店家名稱 <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className="pb-3 text-left font-medium text-gray-500 cursor-pointer select-none" onClick={() => toggleSort("customerCount")}>
                      客人數 <SortIcon col="customerCount" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className="pb-3 text-left font-medium text-gray-500">寵物數</th>
                    <th className="pb-3 text-right font-medium text-gray-500">總預約</th>
                    <th className="pb-3 text-right font-medium text-gray-500">本月預約</th>
                    <th className="pb-3 text-right font-medium text-gray-500">照片數</th>
                    <th className="pb-3 text-left font-medium text-gray-500 cursor-pointer select-none" onClick={() => toggleSort("subStatus")}>
                      方案狀態 <SortIcon col="subStatus" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                    <th className="pb-3 text-left font-medium text-gray-500 cursor-pointer select-none" onClick={() => toggleSort("currentPeriodEnd")}>
                      到期日 <SortIcon col="currentPeriodEnd" sortKey={sortKey} sortDir={sortDir} />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedUsage.map((shop) => {
                    const pct = shop.maxCustomers < UNLIMITED ? (shop.customerCount / shop.maxCustomers) * 100 : 0
                    const isOverLimit = shop.maxCustomers < UNLIMITED && pct >= 80
                    const meta = shop.subStatus ? STATUS_META[shop.subStatus] : null
                    return (
                      <tr
                        key={shop.id}
                        className={`hover:bg-gray-50/50 ${isOverLimit ? "bg-red-50/40" : ""}`}
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {isOverLimit && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                            <div>
                              <p className={`font-medium ${isOverLimit ? "text-red-700" : "text-gray-900"}`}>{shop.name}</p>
                              <p className="text-xs text-gray-400 font-mono">{shop.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <MiniBar current={shop.customerCount} max={shop.maxCustomers} />
                        </td>
                        <td className="py-3 pr-4 text-gray-700">{shop.petCount}</td>
                        <td className="py-3 pr-4 text-right text-gray-700">{shop.totalAppointments}</td>
                        <td className="py-3 pr-4 text-right text-gray-700">{shop.monthlyAppointments}</td>
                        <td className="py-3 pr-4 text-right text-gray-700">{shop.photoCount}</td>
                        <td className="py-3 pr-4">
                          {meta ? (
                            <Badge className={`text-xs ${meta.badge}`}>{meta.label}</Badge>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                          {shop.subPlanName && (
                            <p className="text-xs text-gray-400 mt-0.5">{shop.subPlanName}</p>
                          )}
                        </td>
                        <td className="py-3 text-gray-600 text-xs">
                          {shop.currentPeriodEnd
                            ? format(new Date(shop.currentPeriodEnd), "yyyy/MM/dd")
                            : "—"}
                        </td>
                      </tr>
                    )
                  })}
                  {sortedUsage.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">尚無店家資料</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
