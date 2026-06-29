"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { Building2, Users, Clock, Shield, ToggleLeft, ToggleRight, ChevronLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import Link from "next/link"

interface ShopDetail {
  id: string
  name: string
  phone: string | null
  address: string | null
  email: string | null
  status: string
  createdAt: string
  users: Array<{ id: string; name: string; email: string; role: string; isActive: boolean; isSuperAdmin: boolean }>
  _count: { customers: number; appointments: number }
  subscriptions: Array<{
    id: string
    status: string
    currentPeriodStart: string
    currentPeriodEnd: string
    plan: { name: string; price: number; maxCustomers: number; maxStaff: number }
  }>
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TRIAL: { label: "試用中", color: "bg-blue-100 text-blue-700" },
  ACTIVE: { label: "訂閱中", color: "bg-green-100 text-green-700" },
  PAST_DUE: { label: "逾期", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "已取消", color: "bg-gray-100 text-gray-700" },
}

export default function AdminShopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [shop, setShop] = useState<ShopDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [extendDays, setExtendDays] = useState("7")
  const [acting, setActing] = useState(false)
  const [message, setMessage] = useState("")

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/admin/shops/${id}`)
    if (res.ok) setShop(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function doAction(action: string, extra?: Record<string, unknown>) {
    setActing(true)
    setMessage("")
    const res = await fetch(`/api/admin/shops/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    })
    const data = await res.json()
    setActing(false)
    if (data.success) {
      setMessage("操作成功！")
      await load()
      setTimeout(() => setMessage(""), 3000)
    }
  }

  if (loading) return <div className="p-6 text-gray-400">載入中...</div>
  if (!shop) return <div className="p-6 text-red-500">找不到此店家</div>

  const sub = shop.subscriptions[0]
  const isActive = shop.users.some((u) => u.isActive)
  const isPending = shop.status === "PENDING"

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/shops" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500 font-mono">{shop.id}</p>
            {isPending && (
              <Badge className="bg-yellow-100 text-yellow-700 text-xs">待審核</Badge>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{message}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        {[
          { label: "客人數", value: shop._count.customers, icon: Users },
          { label: "預約筆數", value: shop._count.appointments, icon: Clock },
          { label: "員工數", value: shop.users.length, icon: Shield },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-gray-100 p-2.5">
                <s.icon className="h-4 w-4 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Subscription */}
        <Card>
          <CardHeader><CardTitle className="text-base">訂閱狀態</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sub ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">方案</span>
                  <span className="font-medium">{sub.plan.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">狀態</span>
                  {(() => {
                    const info = STATUS_LABELS[sub.status] ?? { label: sub.status, color: "bg-gray-100 text-gray-700" }
                    return <Badge className={`text-xs ${info.color}`}>{info.label}</Badge>
                  })()}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">到期日</span>
                  <span className="text-sm">{format(new Date(sub.currentPeriodEnd), "yyyy/MM/dd")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">上限</span>
                  <span className="text-sm">{sub.plan.maxCustomers} 客人 / {sub.plan.maxStaff} 員工</span>
                </div>
              </>
            ) : <p className="text-sm text-gray-400">尚無訂閱紀錄</p>}

            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-2">手動延長試用</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  className="h-8 w-20 text-sm"
                />
                <span className="flex items-center text-sm text-gray-500">天</span>
                <Button size="sm" onClick={() => doAction("extend_trial", { days: Number(extendDays) })} disabled={acting}>
                  延長
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shop status */}
        <Card>
          <CardHeader><CardTitle className="text-base">店家控制</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isPending && (
              <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
                <p className="text-sm font-medium text-yellow-800 mb-1">此店家申請尚待審核</p>
                <p className="text-xs text-yellow-600 mb-3">核准後將發送通知 Email 給店家，並啟用其帳號。</p>
                <Button
                  size="sm"
                  onClick={() => doAction("approve_shop")}
                  disabled={acting}
                  className="bg-green-600 hover:bg-green-700 text-white w-full"
                >
                  核准申請
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">帳號狀態</p>
                <p className="text-xs text-gray-500">{isActive ? "店家員工帳號可正常登入" : "所有員工帳號已停用"}</p>
              </div>
              {isActive ? (
                <ToggleRight className="h-6 w-6 text-green-500" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-gray-400" />
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => doAction("enable_shop")}
                disabled={acting || isActive}
                className="flex-1"
              >
                啟用店家
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => doAction("disable_shop")}
                disabled={acting || !isActive}
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
              >
                停用店家
              </Button>
            </div>

            {/* Basic info */}
            <div className="space-y-1.5 pt-2 border-t border-gray-100 text-sm text-gray-600">
              {shop.phone && <p>電話：{shop.phone}</p>}
              {shop.address && <p>地址：{shop.address}</p>}
              {shop.email && <p>Email：{shop.email}</p>}
              <p>建立：{format(new Date(shop.createdAt), "yyyy/MM/dd HH:mm")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff list */}
      <Card>
        <CardHeader><CardTitle className="text-base">員工帳號</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-3 text-left font-medium text-gray-500">姓名</th>
                <th className="pb-3 text-left font-medium text-gray-500">Email</th>
                <th className="pb-3 text-left font-medium text-gray-500">角色</th>
                <th className="pb-3 text-left font-medium text-gray-500">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shop.users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 pr-4 font-medium text-gray-900">{u.name}</td>
                  <td className="py-3 pr-4 text-gray-600">{u.email}</td>
                  <td className="py-3 pr-4 text-gray-600">{u.role}</td>
                  <td className="py-3">
                    <Badge className={u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                      {u.isActive ? "啟用" : "停用"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
