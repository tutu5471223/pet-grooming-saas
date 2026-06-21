"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format, differenceInDays } from "date-fns"
import {
  Plus,
  CheckCircle2,
  Trash2,
  Receipt,
  Search,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CollectPaymentDialog } from "@/components/dashboard/collect-payment-dialog"

interface ARPayment {
  id: string
  amount: number
  billingType: string
  paymentMethod: string | null
  status: string
  notes: string | null
  paidAt: string | null
  customer: { id: string; name: string; phone: string }
  groomingRecord: { date: string; services: string | null } | null
  boardingRecord: { checkIn: string; checkOut: string | null } | null
}

interface CustomerOption {
  id: string
  name: string
  phone: string
}

function AgingBadge({ paidAt }: { paidAt: string | null }) {
  const days = paidAt ? differenceInDays(new Date(), new Date(paidAt)) : 0
  if (days <= 7) return <Badge className="bg-green-100 text-green-700">7天內</Badge>
  if (days <= 30) return <Badge className="bg-yellow-100 text-yellow-700">{days}天</Badge>
  return <Badge className="bg-red-100 text-red-700">{days}天 逾期</Badge>
}

interface Props {
  items: ARPayment[]
  status: "PENDING" | "PAID"
  isOwner: boolean
}

export function ReceivablesClient({ items, status, isOwner }: Props) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customerSearch, setCustomerSearch] = useState("")
  const [form, setForm] = useState({ customerId: "", amount: "", notes: "" })
  const [creating, setCreating] = useState(false)
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  // CREDIT / MONTHLY_PLAN receivables must be settled via the collect flow
  // (stored-value / monthly-plan side effects). PATCH-to-PAID is rejected (422)
  // for those billing types, so route them through the collect dialog.
  const [collectTarget, setCollectTarget] = useState<{ id: string; amount: number } | null>(null)

  function handleCustomerSearch(value: string) {
    setCustomerSearch(value)
    if (searchTimer) clearTimeout(searchTimer)
    if (!value) { setCustomers([]); return }
    const t = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(value)}&limit=10`)
        .then((r) => r.json())
        .then((d) => setCustomers(Array.isArray(d) ? d : d.customers ?? []))
        .catch(() => setCustomers([]))
    }, 300)
    setSearchTimer(t)
  }

  async function markPaid(item: ARPayment) {
    // CREDIT / MONTHLY_PLAN must go through the collect endpoint (the PATCH
    // route returns 422 USE_COLLECT_ENDPOINT for them). Open the collect dialog.
    if (item.billingType === "CREDIT" || item.billingType === "MONTHLY_PLAN") {
      setCollectTarget({ id: item.id, amount: item.amount })
      return
    }
    // SINGLE (and any other) receivables: mark paid directly via PATCH.
    const res = await fetch(`/api/receivables/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    })
    if (!res.ok) {
      // 422 USE_COLLECT_ENDPOINT (defensive — should not happen for SINGLE)
      // routes the user to the collect flow; any other error is surfaced.
      if (res.status === 422) {
        setCollectTarget({ id: item.id, amount: item.amount })
        return
      }
      const data = await res.json().catch(() => ({}))
      alert(data.error || "操作失敗，請稍後再試")
      return
    }
    router.refresh()
  }

  async function deleteAR(id: string) {
    if (!confirm("確定要刪除這筆應收帳款？")) return
    await fetch(`/api/receivables/${id}`, { method: "DELETE" })
    router.refresh()
  }

  async function createAR() {
    if (!form.customerId || !form.amount) return
    setCreating(true)
    await fetch("/api/receivables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: form.customerId, amount: Number(form.amount), notes: form.notes }),
    })
    setCreating(false)
    setShowCreate(false)
    setForm({ customerId: "", amount: "", notes: "" })
    setCustomerSearch("")
    router.refresh()
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={() => setShowCreate(true)} disabled={!isOwner}>
          <Plus className="h-4 w-4 mr-1.5" /> 新增應收款
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">帳款列表</CardTitle>
          <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
            {(["PENDING", "PAID"] as const).map((s) => (
              <button
                key={s}
                onClick={() => router.push(`/receivables?status=${s}`)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  status === s ? "bg-indigo-600 text-white" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {s === "PENDING" ? "待收款" : "已收款"}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Receipt className="h-10 w-10 mb-2" />
              <p className="text-sm">{status === "PENDING" ? "目前無待收款項" : "目前無已收款紀錄"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 text-left font-medium text-gray-500">客人</th>
                    <th className="pb-3 text-left font-medium text-gray-500">建立日期</th>
                    <th className="pb-3 text-left font-medium text-gray-500">帳齡</th>
                    <th className="pb-3 text-left font-medium text-gray-500">備註</th>
                    <th className="pb-3 text-right font-medium text-gray-500">金額</th>
                    {status === "PENDING" && (
                      <th className="pb-3 text-right font-medium text-gray-500">操作</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900">{item.customer.name}</p>
                        <p className="text-xs text-gray-500">{item.customer.phone}</p>
                      </td>
                      <td className="py-3 pr-4 text-gray-700">
                        {item.paidAt ? format(new Date(item.paidAt), "MM/dd HH:mm") : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <AgingBadge paidAt={item.paidAt} />
                      </td>
                      <td className="py-3 pr-4 text-gray-500 max-w-[200px] truncate">
                        {item.notes ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold text-gray-900">
                        {formatCurrency(item.amount)}
                      </td>
                      {status === "PENDING" && (
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => markPaid(item)}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteAR(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增應收帳款</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">搜尋客人 *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="輸入姓名或電話"
                  value={customerSearch}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                />
              </div>
              {customers.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-md overflow-hidden">
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      className="w-full px-3 py-2.5 text-left hover:bg-gray-50 text-sm"
                      onClick={() => { setForm({ ...form, customerId: c.id }); setCustomerSearch(`${c.name} (${c.phone})`); setCustomers([]) }}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-2 text-gray-500">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">金額 (NT$) *</Label>
              <Input
                type="number"
                min={1}
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">備註</Label>
              <Input
                placeholder="例：11月美容費用"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={createAR}
                disabled={creating || !form.customerId || !form.amount}
                className="flex-1"
              >
                {creating ? "建立中..." : "建立帳款"}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {collectTarget && (
        <CollectPaymentDialog
          paymentId={collectTarget.id}
          amount={collectTarget.amount}
          open={!!collectTarget}
          onOpenChange={(open) => {
            if (!open) {
              setCollectTarget(null)
              router.refresh()
            }
          }}
        />
      )}
    </>
  )
}
