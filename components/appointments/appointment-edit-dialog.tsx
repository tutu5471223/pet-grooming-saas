"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Staff { id: string; name: string }
interface Service { id: string; name: string; category: string | null; price: number; duration: number | null }
interface SelectedService { id: string; name: string; price: number; duration: number | null }

interface AppointmentData {
  id: string
  scheduledAt: string
  staffId: string | null
  services: string | null
  estimatedCost: number | null
  duration: number | null
  notes: string | null
  status: string
}

interface Props {
  appointment: AppointmentData
  open: boolean
  onClose: () => void
}

export function AppointmentEditDialog({ appointment, open, onClose }: Props) {
  const router = useRouter()
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [allServices, setAllServices] = useState<Service[]>([])
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    scheduledAt: "",
    staffId: "",
    estimatedCost: "",
    duration: "",
    notes: "",
  })

  useEffect(() => {
    if (!open) return

    const dt = new Date(appointment.scheduledAt)
    const pad = (n: number) => String(n).padStart(2, "0")
    const local = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`

    let parsed: SelectedService[] = []
    try { parsed = JSON.parse(appointment.services ?? "[]") } catch {}

    setForm({
      scheduledAt: local,
      staffId: appointment.staffId ?? "",
      estimatedCost: appointment.estimatedCost != null ? String(appointment.estimatedCost) : "",
      duration: appointment.duration != null ? String(appointment.duration) : "",
      notes: appointment.notes ?? "",
    })
    setSelectedServices(parsed)

    Promise.all([
      fetch("/api/staff").then(r => r.json()),
      fetch("/api/services").then(r => r.json()),
    ]).then(([staff, svcs]: [Staff[], Service[]]) => {
      setStaffList(staff)
      setAllServices(svcs)
    }).catch(() => {})
  }, [open, appointment])

  function addService(svc: Service) {
    if (selectedServices.find(s => s.id === svc.id)) return
    const updated = [...selectedServices, { id: svc.id, name: svc.name, price: svc.price, duration: svc.duration }]
    setSelectedServices(updated)
    setForm(f => ({ ...f, estimatedCost: String(updated.reduce((s, v) => s + v.price, 0)) }))
  }

  function removeService(id: string) {
    const updated = selectedServices.filter(s => s.id !== id)
    setSelectedServices(updated)
    setForm(f => ({ ...f, estimatedCost: updated.length > 0 ? String(updated.reduce((s, v) => s + v.price, 0)) : "" }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          staffId: form.staffId || null,
          services: selectedServices.map(({ name, price }) => ({ name, price })),
          estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
          duration: form.duration ? Number(form.duration) : null,
          notes: form.notes || null,
        }),
      })
      router.refresh()
      onClose()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const grouped = allServices.reduce<Record<string, Service[]>>((acc, svc) => {
    const cat = svc.category ?? "其他"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(svc)
    return acc
  }, {})

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯預約</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>預約時間</Label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label>負責美容師</Label>
            <select
              value={form.staffId}
              onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">不指定</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label>服務項目</Label>
            {selectedServices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                {selectedServices.map(s => (
                  <span key={s.id} className="flex items-center gap-1 rounded-full bg-indigo-100 pl-2.5 pr-1 py-0.5 text-xs text-indigo-700">
                    {s.name}
                    <button type="button" onClick={() => removeService(s.id)} className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-indigo-300 transition-colors">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {Object.entries(grouped).map(([cat, svcs]) => (
                <div key={cat}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{cat}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {svcs.map(svc => {
                      const selected = selectedServices.some(s => s.id === svc.id)
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => selected ? removeService(svc.id) : addService(svc)}
                          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            selected
                              ? "border-indigo-500 bg-indigo-600 text-white"
                              : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300"
                          }`}
                        >
                          {!selected && <Plus className="h-3 w-3" />}
                          {svc.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>預估費用（元）</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={form.estimatedCost}
                onChange={e => setForm(f => ({ ...f, estimatedCost: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>時長（分鐘）</Label>
              <Input
                type="number"
                min="0"
                placeholder="60"
                value={form.duration}
                onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>備註</Label>
            <Textarea
              placeholder="特殊需求..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="button" disabled={saving} onClick={handleSave}>
              {saving ? "儲存中..." : "儲存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
