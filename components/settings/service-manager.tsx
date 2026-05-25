"use client"

import { useState } from "react"
import { Plus, Scissors, Pencil, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

interface Service {
  id: string
  name: string
  category: string | null
  price: number
  duration: number | null
  isActive: boolean
}

export function ServiceManager({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState(initialServices)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", category: "", price: "", duration: "" })
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", category: "", price: "", duration: "" })

  const grouped = services.reduce<Record<string, Service[]>>((acc, svc) => {
    const cat = svc.category ?? "未分類"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(svc)
    return acc
  }, {})

  async function addService(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        category: form.category || null,
        price: Number(form.price),
        duration: form.duration ? Number(form.duration) : null,
      }),
    })
    const svc = await res.json()
    setServices([...services, svc])
    setForm({ name: "", category: "", price: "", duration: "" })
    setShowForm(false)
    setLoading(false)
  }

  function startEdit(svc: Service) {
    setEditId(svc.id)
    setEditForm({
      name: svc.name,
      category: svc.category ?? "",
      price: String(svc.price),
      duration: svc.duration ? String(svc.duration) : "",
    })
  }

  async function saveEdit(id: string) {
    await fetch(`/api/services/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        category: editForm.category || null,
        price: Number(editForm.price),
        duration: editForm.duration ? Number(editForm.duration) : null,
      }),
    })
    setServices(services.map((s) =>
      s.id === id
        ? { ...s, name: editForm.name, category: editForm.category || null, price: Number(editForm.price), duration: editForm.duration ? Number(editForm.duration) : null }
        : s
    ))
    setEditId(null)
  }

  async function deleteService(id: string) {
    if (!confirm("確定要停用這個服務項目？")) return
    await fetch(`/api/services/${id}`, { method: "DELETE" })
    setServices(services.filter((s) => s.id !== id))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Scissors className="h-4 w-4" /> 服務項目管理
        </CardTitle>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> 新增
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form onSubmit={addService} className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">服務名稱 *</Label>
                <Input placeholder="例：全套美容" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">分類</Label>
                <Input placeholder="例：美容、洗澡" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">價格 (NT$)</Label>
                <Input type="number" placeholder="1200" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required min={0} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">時間 (分鐘)</Label>
                <Input type="number" placeholder="120" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} min={0} className="h-8 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={loading}>{loading ? "儲存中..." : "儲存"}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>取消</Button>
            </div>
          </form>
        )}

        {Object.entries(grouped).map(([category, svcs]) => (
          <div key={category}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {category}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {svcs.map((svc) => (
                <div key={svc.id} className="rounded-lg border border-gray-200 bg-white">
                  {editId === svc.id ? (
                    <div className="p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="名稱" className="h-7 text-xs" />
                        <Input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} placeholder="分類" className="h-7 text-xs" />
                        <Input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} placeholder="價格" className="h-7 text-xs" />
                        <Input type="number" value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })} placeholder="分鐘" className="h-7 text-xs" />
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-6 text-xs" onClick={() => saveEdit(svc.id)}><Check className="h-3 w-3 mr-1" />確認</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditId(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                        {svc.duration && <p className="text-xs text-gray-500">{svc.duration} 分鐘</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-indigo-600">{formatCurrency(svc.price)}</span>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(svc)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-500 hover:bg-red-50" onClick={() => deleteService(svc.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
