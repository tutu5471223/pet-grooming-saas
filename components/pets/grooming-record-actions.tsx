"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"

interface Service {
  name: string
  price: number
}

interface GroomingRecord {
  id: string
  date: string
  groomerId: string | null
  groomerName: string | null
  services: Service[]
  products: string | null
  totalCost: number
  skinCondition: string | null
  furCondition: string | null
  notes: string | null
}

interface Staff {
  id: string
  name: string
}

interface GroomingRecordActionsProps {
  record: GroomingRecord
  staffList: Staff[]
  hasSignature: boolean
}

export function GroomingRecordActions({ record, staffList, hasSignature }: GroomingRecordActionsProps) {
  const router = useRouter()
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    date: record.date,
    groomerId: record.groomerId ?? "",
    products: record.products ?? "",
    skinCondition: record.skinCondition ?? "",
    furCondition: record.furCondition ?? "",
    notes: record.notes ?? "",
  })
  const [services, setServices] = useState<Service[]>(record.services)

  const totalCost = services.reduce((sum, s) => sum + (s.price || 0), 0)

  function addService() {
    setServices((prev) => [...prev, { name: "", price: 0 }])
  }

  function removeService(idx: number) {
    setServices((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateService(idx: number, field: keyof Service, value: string | number) {
    setServices((prev) => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: field === "price" ? Number(value) : value }
      return updated
    })
  }

  async function handleSave() {
    if (services.some((s) => !s.name)) { setError("請填寫所有服務名稱"); return }
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/grooming/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          groomerId: form.groomerId || null,
          services,
          totalCost,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "儲存失敗") }
      setShowEdit(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/grooming/${record.id}`, { method: "DELETE" })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "刪除失敗") }
      setShowDelete(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "刪除失敗")
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5 mt-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => { setShowEdit(true); setError("") }}
        >
          <Pencil className="h-3 w-3" />
          編輯
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => setShowDelete(true)}
        >
          <Trash2 className="h-3 w-3" />
          刪除
        </Button>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯美容紀錄</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>美容日期</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>美容師</Label>
                <select
                  value={form.groomerId}
                  onChange={(e) => setForm((f) => ({ ...f, groomerId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">未指定</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>服務項目</Label>
                <Button type="button" variant="outline" size="sm" onClick={addService} className="h-7 text-xs">
                  <Plus className="h-3 w-3" /> 新增
                </Button>
              </div>
              {services.map((svc, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="服務名稱"
                    value={svc.name}
                    onChange={(e) => updateService(idx, "name", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="金額"
                    value={svc.price || ""}
                    onChange={(e) => updateService(idx, "price", e.target.value)}
                    className="w-24"
                    min={0}
                  />
                  {services.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeService(idx)} className="h-8 w-8 text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-right text-sm font-semibold text-gray-700">合計：{formatCurrency(totalCost)}</p>
            </div>

            <div className="space-y-1.5">
              <Label>使用產品</Label>
              <Input
                value={form.products}
                onChange={(e) => setForm((f) => ({ ...f, products: e.target.value }))}
                placeholder="選填"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>皮膚狀況</Label>
                <Input value={form.skinCondition} onChange={(e) => setForm((f) => ({ ...f, skinCondition: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>毛況</Label>
                <Input value={form.furCondition} onChange={(e) => setForm((f) => ({ ...f, furCondition: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "儲存中..." : "儲存"}
              </Button>
              <Button variant="outline" onClick={() => setShowEdit(false)}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              確定要刪除此美容紀錄？
              {hasSignature && <span className="block mt-1 text-amber-700">⚠ 此紀錄已有客人簽名，刪除後將一併移除。</span>}
              關聯的應收帳款也將同步刪除，此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="destructive" className="flex-1" disabled={deleting} onClick={handleDelete}>
              {deleting ? "刪除中..." : "確認刪除"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setShowDelete(false)}>取消</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
