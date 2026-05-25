"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, CheckCircle2, XCircle, ShieldOff, ShieldCheck, RefreshCw, Store, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface ShopRecord {
  id: string
  name: string
  phone: string | null
  city: string | null
  status: string
  registeredAt: string
  users: { name: string; email: string | null }[]
  _count: { customers: number }
}

interface ConfirmAction {
  shopId: string
  shopName: string
  action: "approve" | "reject" | "suspend" | "activate"
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "待審核", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  ACTIVE:    { label: "正常",   color: "bg-green-50 text-green-700 border-green-200" },
  SUSPENDED: { label: "已停用", color: "bg-red-50 text-red-700 border-red-200" },
  REJECTED:  { label: "已拒絕", color: "bg-gray-50 text-gray-600 border-gray-200" },
}

const ACTION_LABEL: Record<string, string> = {
  approve: "核准",
  reject: "拒絕",
  suspend: "停用",
  activate: "啟用",
}

export default function SuperAdminPage() {
  const [tab, setTab] = useState<"pending" | "all">("pending")
  const [shops, setShops] = useState<ShopRecord[]>([])
  const [allShops, setAllShops] = useState<ShopRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [actioning, setActioning] = useState(false)
  const [actionError, setActionError] = useState("")

  const fetchPending = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/superadmin/shops?status=PENDING")
      setShops(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAll = useCallback(async (q = "") => {
    setLoading(true)
    try {
      const res = await fetch(`/api/superadmin/shops${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      setAllShops(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])
  useEffect(() => { if (tab === "all") fetchAll() }, [tab, fetchAll])

  async function doAction() {
    if (!confirm) return
    setActioning(true)
    setActionError("")
    try {
      const res = await fetch(`/api/superadmin/shops/${confirm.shopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: confirm.action }),
      })
      if (!res.ok) throw new Error("操作失敗")
      setConfirm(null)
      fetchPending()
      if (tab === "all") fetchAll(search)
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "操作失敗")
    } finally {
      setActioning(false)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" })
  }

  const displayedAll = allShops

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">超級管理後台</h1>
        <p className="text-sm text-gray-500 mt-1">管理所有店家申請與帳號狀態</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "pending" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          待審核
          {shops.length > 0 && (
            <span className="ml-2 rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 text-xs font-semibold">
              {shops.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("all")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "all" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          所有店家
        </button>
      </div>

      {tab === "pending" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">待審核申請 ({shops.length})</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchPending} className="h-8 gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />刷新
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-sm text-gray-400 py-8">載入中...</p>
            ) : shops.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm">目前沒有待審核的申請</p>
              </div>
            ) : (
              <div className="space-y-3">
                {shops.map((shop) => {
                  const owner = shop.users[0]
                  return (
                    <div key={shop.id} className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Store className="h-4 w-4 text-yellow-600 shrink-0" />
                            <p className="font-semibold text-gray-900">{shop.name}</p>
                            {shop.city && <span className="text-xs text-gray-500 bg-white rounded-full px-2 py-0.5 border">{shop.city}</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-600 mt-1">
                            <span>負責人：{owner?.name ?? "—"}</span>
                            <span>電話：{shop.phone ?? "—"}</span>
                            <span className="col-span-2">Email：{owner?.email ?? "—"}</span>
                            <span>申請時間：{formatDate(shop.registeredAt)}</span>
                            <span>店家 ID：<span className="font-mono">{shop.id}</span></span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 gap-1"
                            onClick={() => setConfirm({ shopId: shop.id, shopName: shop.name, action: "approve" })}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />核准
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 gap-1"
                            onClick={() => setConfirm({ shopId: shop.id, shopName: shop.name, action: "reject" })}
                          >
                            <XCircle className="h-3.5 w-3.5" />拒絕
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "all" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">所有店家</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <Input
                  placeholder="搜尋店名"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchAll(search)}
                  className="pl-8 h-8 text-sm w-44"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => fetchAll(search)} className="h-8 gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />搜尋
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-sm text-gray-400 py-8">載入中...</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="pb-2 text-left font-medium text-gray-500">店名</th>
                    <th className="pb-2 text-left font-medium text-gray-500">負責人</th>
                    <th className="pb-2 text-left font-medium text-gray-500">縣市</th>
                    <th className="pb-2 text-left font-medium text-gray-500">申請時間</th>
                    <th className="pb-2 text-left font-medium text-gray-500">狀態</th>
                    <th className="pb-2 text-right font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {displayedAll.map((shop) => {
                    const owner = shop.users[0]
                    const st = STATUS_LABEL[shop.status] ?? { label: shop.status, color: "bg-gray-50 text-gray-600 border-gray-200" }
                    return (
                      <tr key={shop.id}>
                        <td className="py-2.5">
                          <p className="font-medium text-gray-900">{shop.name}</p>
                          <p className="text-xs text-gray-400 font-mono">{shop.id}</p>
                        </td>
                        <td className="py-2.5 text-gray-700">
                          <p>{owner?.name ?? "—"}</p>
                          <p className="text-xs text-gray-400">{owner?.email ?? "—"}</p>
                        </td>
                        <td className="py-2.5 text-gray-600">{shop.city ?? "—"}</td>
                        <td className="py-2.5 text-gray-600">{formatDate(shop.registeredAt)}</td>
                        <td className="py-2.5">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          {shop.status === "ACTIVE" && (
                            <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 h-7 text-xs gap-1"
                              onClick={() => setConfirm({ shopId: shop.id, shopName: shop.name, action: "suspend" })}>
                              <ShieldOff className="h-3 w-3" />停用
                            </Button>
                          )}
                          {shop.status === "SUSPENDED" && (
                            <Button size="sm" variant="outline" className="border-green-300 text-green-600 hover:bg-green-50 h-7 text-xs gap-1"
                              onClick={() => setConfirm({ shopId: shop.id, shopName: shop.name, action: "activate" })}>
                              <ShieldCheck className="h-3 w-3" />啟用
                            </Button>
                          )}
                          {shop.status === "PENDING" && (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 gap-1"
                                onClick={() => setConfirm({ shopId: shop.id, shopName: shop.name, action: "approve" })}>
                                <CheckCircle2 className="h-3 w-3" />核准
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50 gap-1"
                                onClick={() => setConfirm({ shopId: shop.id, shopName: shop.name, action: "reject" })}>
                                <XCircle className="h-3 w-3" />拒絕
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirm dialog */}
      <Dialog open={!!confirm} onOpenChange={() => { setConfirm(null); setActionError("") }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認操作</DialogTitle>
            <DialogDescription>
              確定要{confirm ? ACTION_LABEL[confirm.action] : ""}「{confirm?.shopName}」嗎？
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <Button onClick={doAction} disabled={actioning} className="flex-1">
              {actioning ? "處理中..." : `確認${confirm ? ACTION_LABEL[confirm.action] : ""}`}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => { setConfirm(null); setActionError("") }}>
              取消
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
