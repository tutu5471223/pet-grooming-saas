"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Syringe, AlertTriangle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface VaccineRecord {
  id: string
  name: string
  date: string
  nextDate: string | null
  clinic: string | null
}

function vaccineBadge(nextDate: string | null) {
  if (!nextDate) return null
  const next = new Date(nextDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { label: "已過期", className: "bg-red-100 text-red-700" }
  if (diffDays <= 30) return { label: "即將到期", className: "bg-yellow-100 text-yellow-700" }
  return null
}

export function VaccineManager({
  petId,
  initialRecords,
}: {
  petId: string
  initialRecords: VaccineRecord[]
}) {
  const router = useRouter()
  const [records, setRecords] = useState<VaccineRecord[]>(initialRecords)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", date: "", nextDate: "", clinic: "" })
  const [error, setError] = useState("")

  async function patchRecords(updated: VaccineRecord[]) {
    setSaving(true)
    const res = await fetch(`/api/pets/${petId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaccineRecords: updated }),
    })
    setSaving(false)
    if (!res.ok) { setError("儲存失敗"); return false }
    router.refresh()
    return true
  }

  async function handleAdd() {
    if (!form.name) { setError("請填寫疫苗名稱"); return }
    if (!form.date) { setError("請填寫施打日期"); return }
    setError("")
    const rec: VaccineRecord = {
      id: Date.now().toString(),
      name: form.name,
      date: form.date,
      nextDate: form.nextDate || null,
      clinic: form.clinic || null,
    }
    const updated = [...records, rec]
    if (await patchRecords(updated)) {
      setRecords(updated)
      setForm({ name: "", date: "", nextDate: "", clinic: "" })
      setShowForm(false)
    }
  }

  async function handleDelete(id: string) {
    const updated = records.filter((r) => r.id !== id)
    if (await patchRecords(updated)) setRecords(updated)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Syringe className="h-4 w-4 text-blue-500" />
          疫苗紀錄
        </CardTitle>
        {!showForm && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            新增疫苗
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">疫苗名稱 *</Label>
                <Input
                  placeholder="例：狂犬病疫苗"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">獸醫診所</Label>
                <Input
                  placeholder="例：XX動物醫院"
                  value={form.clinic}
                  onChange={(e) => setForm({ ...form, clinic: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">施打日期 *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">下次施打日</Label>
                <Input
                  type="date"
                  value={form.nextDate}
                  onChange={(e) => setForm({ ...form, nextDate: e.target.value })}
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={saving}>
                {saving ? "儲存中..." : "儲存"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowForm(false); setError("") }}
              >
                取消
              </Button>
            </div>
          </div>
        )}

        {records.length === 0 && !showForm ? (
          <p className="text-sm text-gray-400 text-center py-4">尚無疫苗紀錄</p>
        ) : (
          <div className="space-y-2">
            {records.map((rec) => {
              const badge = vaccineBadge(rec.nextDate)
              return (
                <div
                  key={rec.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{rec.name}</span>
                      {badge && (
                        <span className={`text-xs font-medium rounded-full px-2 py-0.5 flex items-center gap-1 ${badge.className}`}>
                          {badge.label === "已過期"
                            ? <XCircle className="h-3 w-3" />
                            : <AlertTriangle className="h-3 w-3" />}
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      施打：{rec.date}
                      {rec.nextDate && ` · 下次：${rec.nextDate}`}
                      {rec.clinic && ` · ${rec.clinic}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(rec.id)}
                    disabled={saving}
                    className="shrink-0 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
