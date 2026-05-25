"use client"

import { useState, useEffect, useCallback } from "react"
import { format, differenceInDays } from "date-fns"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ClipboardList, Plus } from "lucide-react"

interface DailyLog {
  id: string
  date: string
  condition: string
  note: string | null
  staff: { name: string } | null
}

interface BoardingDetailSheetProps {
  recordId: string
  petName: string
  breed: string | null
  species: string
  customerName: string
  roomName: string
  checkIn: Date | string
  dailyRate: number
}

const CONDITION_COLORS: Record<string, string> = {
  良好: "bg-green-100 text-green-700",
  注意: "bg-yellow-100 text-yellow-700",
  異常: "bg-red-100 text-red-700",
}

export function BoardingDetailSheet({
  recordId,
  petName,
  breed,
  species,
  customerName,
  roomName,
  checkIn,
  dailyRate,
}: BoardingDetailSheetProps) {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ condition: "良好", note: "" })

  const days = Math.max(1, differenceInDays(new Date(), new Date(checkIn)))
  const accruedCost = days * dailyRate

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/boarding/${recordId}/logs`)
      if (res.ok) setLogs(await res.json())
    } finally {
      setLogsLoading(false)
    }
  }, [recordId])

  useEffect(() => {
    if (open) fetchLogs()
  }, [open, fetchLogs])

  async function handleAddLog(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`/api/boarding/${recordId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const newLog = await res.json()
        setLogs([newLog, ...logs])
        setShowForm(false)
        setForm({ condition: "良好", note: "" })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="shrink-0"
      >
        <ClipboardList className="h-4 w-4" />
        查看詳情
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>住宿詳情</DialogTitle>
          </DialogHeader>

          {/* Pet & boarding info */}
          <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 space-y-1">
            <p className="font-bold text-gray-900 text-lg">{petName}</p>
            <p className="text-sm text-gray-600">{breed ?? species} · 飼主：{customerName}</p>
            <div className="pt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-500 text-xs">房間</p>
                <p className="font-medium text-gray-800">{roomName}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">入住日期</p>
                <p className="font-medium text-gray-800">{formatDate(checkIn)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">已住天數</p>
                <p className="font-medium text-gray-800">{days} 天</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">每日費用</p>
                <p className="font-medium text-gray-800">{formatCurrency(dailyRate)}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-orange-200 flex items-center justify-between">
              <span className="text-sm text-gray-600">累計費用</span>
              <span className="text-lg font-bold text-orange-700">{formatCurrency(accruedCost)}</span>
            </div>
          </div>

          {/* Daily logs */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">每日記錄</h3>
              {!showForm && (
                <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  新增今日記錄
                </Button>
              )}
            </div>

            {showForm && (
              <form onSubmit={handleAddLog} className="mb-4 rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50">
                <div className="space-y-1.5">
                  <Label>狀況</Label>
                  <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["良好", "注意", "異常"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>備註</Label>
                  <Textarea
                    placeholder="今日觀察、飲食、行為等..."
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={submitting} className="flex-1">
                    {submitting ? "儲存中..." : "儲存記錄"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
                    取消
                  </Button>
                </div>
              </form>
            )}

            {logsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-sm">
                尚無每日記錄
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-gray-100 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {format(new Date(log.date), "MM/dd")}
                        {log.staff && ` · ${log.staff.name}`}
                      </span>
                      <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${CONDITION_COLORS[log.condition] ?? "bg-gray-100 text-gray-600"}`}>
                        {log.condition}
                      </span>
                    </div>
                    {log.note && (
                      <p className="text-sm text-gray-700">{log.note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
