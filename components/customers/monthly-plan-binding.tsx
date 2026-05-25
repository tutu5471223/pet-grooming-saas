"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CreditCard, CalendarDays, Infinity, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils"
import { addDays } from "date-fns"

interface Plan {
  id: string
  name: string
  price: number
  sessions: number
  description: string | null
  validDays: number
}

interface CurrentPlan {
  id: string
  name: string
  price: number
  sessions: number
  validDays: number
  startDate: string
  usedSessions: number
}

interface MonthlyPlanBindingProps {
  customerId: string
  currentPlan: CurrentPlan | null
  availablePlans: Plan[]
}

export function MonthlyPlanBinding({
  customerId,
  currentPlan,
  availablePlans,
}: MonthlyPlanBindingProps) {
  const router = useRouter()
  const [showBind, setShowBind] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleBind(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlanId) { setError("請選擇方案"); return }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/customers/${customerId}/monthly-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId, startDate }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "綁定失敗")
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "綁定失敗")
    } finally {
      setLoading(false)
    }
  }

  async function handleUnbind() {
    if (!confirm("確認解除月租方案綁定？")) return
    setLoading(true)
    try {
      await fetch(`/api/customers/${customerId}/monthly-plan`, { method: "DELETE" })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (currentPlan) {
    const expiryDate = addDays(new Date(currentPlan.startDate), currentPlan.validDays)
    const isActive = expiryDate > new Date()
    const remaining =
      currentPlan.sessions === 0 ? null : currentPlan.sessions - currentPlan.usedSessions

    return (
      <Card className={`border ${isActive ? "border-indigo-200 bg-indigo-50" : "border-gray-200 bg-gray-50"}`}>
        <CardContent className="p-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <CreditCard className={`h-5 w-5 mt-0.5 ${isActive ? "text-indigo-600" : "text-gray-400"}`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{currentPlan.name}</span>
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${isActive ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}>
                  {isActive ? "生效中" : "已到期"}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  到期日 {formatDate(expiryDate)}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  {remaining === null ? (
                    <>
                      <Infinity className="h-3.5 w-3.5" />
                      無限次
                    </>
                  ) : (
                    <span className={remaining <= 0 ? "text-red-600 font-medium" : ""}>
                      剩餘 {Math.max(0, remaining)} 次
                    </span>
                  )}
                </span>
                <span>·</span>
                <span className="text-indigo-600 font-medium">{formatCurrency(currentPlan.price)}/月</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-red-500 shrink-0"
            onClick={handleUnbind}
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!showBind) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-dashed border-gray-300 px-4 py-3">
        <span className="text-sm text-gray-500">尚未綁定月租方案</span>
        {availablePlans.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setShowBind(true)}>
            <Plus className="h-4 w-4" />
            綁定月租
          </Button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleBind} className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
      <p className="text-sm font-medium text-indigo-800">綁定月租方案</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">選擇方案 *</Label>
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="請選擇" />
            </SelectTrigger>
            <SelectContent>
              {availablePlans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {formatCurrency(p.price)}/月
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">開始日期 *</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-white h-9 text-sm"
            required
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "綁定中..." : "確認綁定"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowBind(false)}>
          取消
        </Button>
      </div>
    </form>
  )
}
