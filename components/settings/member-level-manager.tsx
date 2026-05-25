"use client"

import { useState } from "react"
import { Star, Plus, Pencil, Trash2, RefreshCw, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface MemberLevel {
  id: string
  name: string
  minPoints: number
  discountRate: number
  benefits: string | null
  color: string
}

interface SyncResult {
  upgraded: number
  downgraded: number
  total: number
}

const PRESET_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]

function LevelForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<MemberLevel>
  onSave: (data: Omit<MemberLevel, "id">) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    minPoints: String(initial?.minPoints ?? 0),
    discountRate: String(initial?.discountRate ? ((1 - initial.discountRate) * 10).toFixed(1) : 10),
    benefits: initial?.benefits ?? "",
    color: initial?.color ?? "#6366f1",
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const discount = Number(form.discountRate)
    setSaving(true)
    await onSave({
      name: form.name,
      minPoints: Number(form.minPoints),
      discountRate: discount >= 10 ? 0 : 1 - discount / 10,
      benefits: form.benefits || null,
      color: form.color,
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">等級名稱 *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：銀卡" required className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">最低點數 *</Label>
          <Input type="number" min={0} value={form.minPoints} onChange={(e) => setForm({ ...form, minPoints: e.target.value })} required className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">折扣（折）</Label>
          <Input type="number" min={0} max={10} step={0.1} value={form.discountRate} onChange={(e) => setForm({ ...form, discountRate: e.target.value })} placeholder="10 = 無折扣" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">顏色</Label>
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="h-7 w-7 rounded-full border-2 transition-all"
                style={{ backgroundColor: c, borderColor: form.color === c ? "#111" : "transparent" }}
                onClick={() => setForm({ ...form, color: c })}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">會員福利說明</Label>
        <Input value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} placeholder="例：生日禮、優先預約" className="h-8 text-sm" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>{saving ? "儲存中..." : "儲存"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>取消</Button>
      </div>
    </form>
  )
}

export function MemberLevelManager({ initialLevels }: { initialLevels: MemberLevel[] }) {
  const [levels, setLevels] = useState(initialLevels)
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  async function createLevel(data: Omit<MemberLevel, "id">) {
    const res = await fetch("/api/member-levels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const level = await res.json()
    setLevels([...levels, level].sort((a, b) => a.minPoints - b.minPoints))
    setShowCreate(false)
  }

  async function updateLevel(id: string, data: Omit<MemberLevel, "id">) {
    await fetch(`/api/member-levels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    setLevels(levels.map((l) => (l.id === id ? { ...l, ...data } : l)).sort((a, b) => a.minPoints - b.minPoints))
    setEditId(null)
  }

  async function deleteLevel(id: string) {
    if (!confirm("確定要刪除此會員等級？已使用此等級的客人將被解除指定。")) return
    await fetch(`/api/member-levels/${id}`, { method: "DELETE" })
    setLevels(levels.filter((l) => l.id !== id))
  }

  async function syncAll() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch("/api/member-levels/sync", { method: "POST" })
    const data = await res.json()
    setSyncing(false)
    setSyncResult(data)
    setTimeout(() => setSyncResult(null), 5000)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4" /> 會員等級設定
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={syncAll} disabled={syncing} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "同步中..." : "自動升降級"}
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 新增
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {syncResult && (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            <Check className="h-4 w-4" />
            同步完成：共 {syncResult.total} 位客人，升級 {syncResult.upgraded} 位，降級 {syncResult.downgraded} 位
          </div>
        )}

        {showCreate && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-sm font-medium text-indigo-700 mb-3">新增會員等級</p>
            <LevelForm onSave={createLevel} onCancel={() => setShowCreate(false)} />
          </div>
        )}

        {levels.length === 0 && !showCreate && (
          <div className="py-8 text-center text-gray-400 text-sm">尚未設定會員等級</div>
        )}

        <div className="space-y-3">
          {levels.map((level) => (
            <div key={level.id} className="rounded-xl border border-gray-200 p-4">
              {editId === level.id ? (
                <LevelForm
                  initial={level}
                  onSave={(data) => updateLevel(level.id, data)}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: level.color }}
                  >
                    {level.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{level.name}</span>
                      <span
                        className="text-xs rounded-full px-2 py-0.5 text-white"
                        style={{ backgroundColor: level.color }}
                      >
                        {level.discountRate > 0
                          ? `${((1 - level.discountRate) * 10).toFixed(1)} 折`
                          : "無折扣"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">
                      達到 {level.minPoints.toLocaleString()} 點升級
                    </p>
                    {level.benefits && (
                      <p className="text-xs text-gray-500 mt-0.5">{level.benefits}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditId(level.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteLevel(level.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center">
          點擊「自動升降級」可根據客人目前點數重新計算所有人的會員等級
        </p>
      </CardContent>
    </Card>
  )
}
