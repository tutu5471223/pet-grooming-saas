"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

interface PetMonthlyPlan {
  id: string
  name: string
  maxSessions: number
  usedSessions: number
  pricePerSession: number
  startDate: string | Date
  endDate: string | Date
  notes: string | null
  expiryPolicy: string
  graceDays: number
}

type PlanStatus = "active" | "expired" | "upcoming" | "exhausted" | "grace"

function getPlanStatus(plan: PetMonthlyPlan): PlanStatus {
  const now = new Date()
  const start = new Date(plan.startDate)
  const end = new Date(plan.endDate)
  if (now < start) return "upcoming"
  if (plan.usedSessions >= plan.maxSessions) return "exhausted"
  if (now <= end) return "active"
  if (plan.expiryPolicy === "PERMANENT") return "active"
  if (plan.expiryPolicy === "GRACE_PERIOD") {
    const graceEnd = new Date(end)
    graceEnd.setDate(graceEnd.getDate() + (plan.graceDays ?? 7))
    if (now <= graceEnd) return "grace"
  }
  return "expired"
}

const STATUS_CONFIG: Record<PlanStatus, { label: string; bg: string; text: string; border: string }> = {
  active: { label: "有效", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  expired: { label: "已到期", bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200" },
  upcoming: { label: "未開始", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  exhausted: { label: "次數用完", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  grace: { label: "寬限期", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
}

function formatTaipeiDate(d: string | Date): string {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d)).replace(/\//g, "/")
}

const EXPIRY_POLICY_OPTIONS = [
  { value: "FORFEIT", label: "到期後剩餘次數作廢" },
  { value: "GRACE_PERIOD", label: "到期後寬限幾天" },
  { value: "PERMANENT", label: "剩餘次數永久有效" },
]

export function PetMonthlyPlanManager({
  petId,
  plans,
}: {
  petId: string
  plans: PetMonthlyPlan[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    name: "",
    maxSessions: "",
    pricePerSession: "",
    startDate: "",
    endDate: "",
    notes: "",
    expiryPolicy: "FORFEIT",
    graceDays: "7",
  })
  const [defaultPetPrice, setDefaultPetPrice] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/pets/${petId}/service-prices`)
      .then((r) => r.json())
      .then((data: { serviceId: string; price: number }[]) => {
        if (data.length > 0) setDefaultPetPrice(data[0].price)
      })
      .catch(() => {})
  }, [petId])

  function f(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleCreate() {
    if (!form.name || !form.maxSessions || !form.startDate || !form.endDate) {
      setError("請填寫方案名稱、次數、起訖日期")
      return
    }
    const maxSessions = Number(form.maxSessions)
    const pricePerSession = Number(form.pricePerSession)
    if (maxSessions < 1 || pricePerSession < 0) {
      setError("次數至少 1 次，每次價格不得為負數")
      return
    }
    const graceDays = Number(form.graceDays)
    if (form.expiryPolicy === "GRACE_PERIOD" && (isNaN(graceDays) || graceDays < 1)) {
      setError("寬限天數至少 1 天")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/pets/${petId}/monthly-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          maxSessions,
          pricePerSession,
          startDate: form.startDate,
          endDate: form.endDate,
          notes: form.notes || null,
          expiryPolicy: form.expiryPolicy,
          graceDays: form.expiryPolicy === "GRACE_PERIOD" ? graceDays : 7,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "新增失敗")
      }
      setShowForm(false)
      setForm({ name: "", maxSessions: "", pricePerSession: "", startDate: "", endDate: "", notes: "", expiryPolicy: "FORFEIT", graceDays: "7" })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "新增失敗")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(planId: string) {
    if (!window.confirm("確定刪除此方案？")) return
    try {
      const res = await fetch(`/api/pets/${petId}/monthly-plans/${planId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("刪除失敗")
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "刪除失敗")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">包月美容方案</h3>
        <Button size="sm" onClick={() => {
          if (!showForm && defaultPetPrice !== null) {
            setForm((f) => ({ ...f, pricePerSession: String(defaultPetPrice) }))
          }
          setShowForm(!showForm)
          setError("")
        }}>
          <Plus className="h-4 w-4 mr-1" />
          新增方案
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>方案名稱 *</Label>
                <Input placeholder="例：基礎洗澡包月" value={form.name} onChange={f("name")} />
              </div>
              <div className="space-y-1">
                <Label>次數上限 *</Label>
                <Input type="number" placeholder="4" min="1" value={form.maxSessions} onChange={f("maxSessions")} />
              </div>
              <div className="space-y-1">
                <Label>每次價格 *</Label>
                <Input type="number" placeholder="800" min="0" value={form.pricePerSession} onChange={f("pricePerSession")} />
              </div>
              <div className="space-y-1">
                <Label>開始日期 *</Label>
                <Input type="date" value={form.startDate} onChange={f("startDate")} />
              </div>
              <div className="space-y-1">
                <Label>結束日期 *</Label>
                <Input type="date" value={form.endDate} onChange={f("endDate")} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>過期政策</Label>
                <select
                  value={form.expiryPolicy}
                  onChange={f("expiryPolicy")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {EXPIRY_POLICY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {form.expiryPolicy === "GRACE_PERIOD" && (
                <div className="col-span-2 space-y-1">
                  <Label>寬限天數</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    placeholder="7"
                    value={form.graceDays}
                    onChange={f("graceDays")}
                  />
                </div>
              )}
              <div className="col-span-2 space-y-1">
                <Label>備註</Label>
                <Input placeholder="（選填）" value={form.notes} onChange={f("notes")} />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button onClick={handleCreate} disabled={saving} size="sm">
                {saving ? "儲存中..." : "確認新增"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setError("") }}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {plans.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-gray-300 py-10 text-center text-gray-400">
          <p className="text-sm">尚無包月方案，點擊「新增方案」建立</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const status = getPlanStatus(plan)
            const cfg = STATUS_CONFIG[status]
            const remaining = plan.maxSessions - plan.usedSessions
            const policyLabel = EXPIRY_POLICY_OPTIONS.find(o => o.value === plan.expiryPolicy)?.label ?? ""
            return (
              <Card key={plan.id} className={`border ${cfg.border}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                          {cfg.label}
                        </span>
                        <p className="font-medium text-gray-900">{plan.name}</p>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatTaipeiDate(plan.startDate)} ～ {formatTaipeiDate(plan.endDate)}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        {formatCurrency(plan.pricePerSession)}/次 ・ 已用{" "}
                        <span className="font-medium">{plan.usedSessions}/{plan.maxSessions}</span> 次
                        {(status === "active" || status === "grace") && (
                          <span className="ml-1 text-green-700 font-medium">（剩 {remaining} 次）</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {policyLabel}
                        {plan.expiryPolicy === "GRACE_PERIOD" && `（${plan.graceDays} 天）`}
                      </p>
                      {plan.notes && <p className="text-xs text-gray-400 mt-0.5">{plan.notes}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-red-400 hover:text-red-600"
                      onClick={() => handleDelete(plan.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
