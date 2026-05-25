"use client"

import { useState } from "react"
import { Plus, Trash2, CreditCard, Infinity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

interface MonthlyPlan {
  id: string
  name: string
  price: number
  sessions: number
  description: string | null
  isActive: boolean
}

export function MonthlyPlanManager({ initialPlans }: { initialPlans: MonthlyPlan[] }) {
  const [plans, setPlans] = useState(initialPlans)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", price: "", sessions: "", description: "" })
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/monthly-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        price: Number(form.price),
        sessions: Number(form.sessions),
        description: form.description || null,
      }),
    })
    if (res.ok) {
      const plan = await res.json()
      setPlans([...plans, plan])
      setForm({ name: "", price: "", sessions: "", description: "" })
      setShowForm(false)
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("確認刪除此月租方案？已綁定此方案的客人將失去綁定。")) return
    setDeleting(id)
    const res = await fetch(`/api/monthly-plans/${id}`, { method: "DELETE" })
    if (res.ok) {
      setPlans(plans.filter((p) => p.id !== id))
    }
    setDeleting(null)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> 月租方案管理
        </CardTitle>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> 新增
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">方案名稱 *</Label>
                <Input
                  placeholder="例：基礎月租"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">月費 (NT$) *</Label>
                <Input
                  type="number"
                  placeholder="1800"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                  min={0}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">包含美容次數（0 = 無限）*</Label>
                <Input
                  type="number"
                  placeholder="4"
                  value={form.sessions}
                  onChange={(e) => setForm({ ...form, sessions: e.target.value })}
                  required
                  min={0}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">說明</Label>
                <Input
                  placeholder="例：每週一次，含洗澡剪指甲"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "儲存中..." : "儲存"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                取消
              </Button>
            </div>
          </form>
        )}

        {plans.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">尚未建立月租方案</p>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-start justify-between rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{plan.name}</span>
                    <span className="text-sm font-bold text-indigo-600">
                      {formatCurrency(plan.price)}/月
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-sm text-gray-500">
                    {plan.sessions === 0 ? (
                      <>
                        <Infinity className="h-3.5 w-3.5" />
                        <span>無限次</span>
                      </>
                    ) : (
                      <span>{plan.sessions} 次/月</span>
                    )}
                  </div>
                  {plan.description && (
                    <p className="text-xs text-gray-400 mt-1">{plan.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                  onClick={() => handleDelete(plan.id)}
                  disabled={deleting === plan.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
