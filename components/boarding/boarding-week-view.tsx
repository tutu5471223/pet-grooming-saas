"use client"

import { useState, useEffect } from "react"
import { addDays, startOfWeek, isSameDay, startOfDay } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Phone } from "lucide-react"

export interface WeekRecord {
  id: string
  petName: string
  petBreed: string
  petNotes: string | null
  customerName: string
  customerPhone: string
  roomId: string | null
  checkIn: string
  checkOut: string | null
  status: string
  dailyRate: number
  notes: string | null
}

export interface WeekRoom {
  id: string
  name: string
  type: string | null
}

interface DailyLog {
  id: string
  date: string
  condition: string
  note: string | null
  staff: { name: string } | null
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]

export function BoardingWeekView({
  rooms,
  records,
}: {
  rooms: WeekRoom[]
  records: WeekRecord[]
}) {
  const [selected, setSelected] = useState<WeekRecord | null>(null)
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [newLog, setNewLog] = useState({ condition: "良好", note: "" })
  const [submitting, setSubmitting] = useState(false)

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const days = Array.from({ length: 21 }, (_, i) => addDays(weekStart, i))
  const today = startOfDay(new Date())

  useEffect(() => {
    if (!selected) { setLogs([]); return }
    setLogsLoading(true)
    fetch(`/api/boarding/${selected.id}/logs`)
      .then(r => r.json())
      .then((data: DailyLog[]) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false))
  }, [selected?.id])

  async function handleAddLog() {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/boarding/${selected.id}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition: newLog.condition, note: newLog.note || null }),
      })
      if (res.ok) {
        const log: DailyLog = await res.json()
        setLogs(prev => [log, ...prev])
        setNewLog({ condition: "良好", note: "" })
      }
    } finally {
      setSubmitting(false)
    }
  }

  function getRecord(roomId: string, day: Date): WeekRecord | null {
    const dayStart = startOfDay(day)
    return (
      records.find((r) => {
        if (r.roomId !== roomId) return false
        const checkIn = startOfDay(new Date(r.checkIn))
        const checkOut = r.checkOut ? startOfDay(new Date(r.checkOut)) : null
        return checkIn <= dayStart && (checkOut === null || checkOut >= dayStart)
      }) ?? null
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="w-20 py-2 px-3 text-left font-medium text-gray-500 border-b border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                房間
              </th>
              {days.map((day, i) => {
                const isToday = isSameDay(day, today)
                const isWeekStart = day.getDay() === 1 && i > 0
                return (
                  <th
                    key={i}
                    className={`py-2 px-1 text-center font-medium border-b min-w-[56px] ${
                      isWeekStart ? "border-l-2 border-gray-300" : "border-l border-gray-100"
                    } ${isToday ? "bg-indigo-50 text-indigo-600" : "text-gray-500"}`}
                  >
                    <div className="text-xs">{`${day.getMonth() + 1}/${day.getDate()}`}</div>
                    <div className="text-gray-400">{WEEKDAY_LABELS[day.getDay()]}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 px-3 font-medium text-gray-700 sticky left-0 bg-white z-10 border-r border-gray-200 whitespace-nowrap">
                  <span>{room.name}</span>
                  {room.type && (
                    <span className="ml-1 text-gray-400 font-normal">({room.type})</span>
                  )}
                </td>
                {days.map((day, i) => {
                  const record = getRecord(room.id, day)
                  const isToday = isSameDay(day, today)
                  const isWeekStart = day.getDay() === 1 && i > 0
                  return (
                    <td
                      key={i}
                      className={`py-1 px-0.5 ${
                        isWeekStart ? "border-l-2 border-gray-200" : "border-l border-gray-100"
                      } ${isToday ? "bg-indigo-50" : ""}`}
                    >
                      {record ? (
                        <button
                          onClick={() => setSelected(record)}
                          className="w-full rounded bg-orange-100 hover:bg-orange-200 border border-orange-200 px-1 py-1 text-left transition-colors"
                        >
                          <span className="block text-orange-800 font-medium truncate leading-tight">
                            {record.petName}
                          </span>
                          <span className="block text-orange-500 truncate leading-tight text-[10px]">
                            {record.customerName}
                          </span>
                        </button>
                      ) : (
                        <div className="h-9 rounded bg-gray-50 border border-gray-100" />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr>
                <td colSpan={22} className="py-8 text-center text-gray-400 text-sm">
                  尚未設定任何房間
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>住宿詳情</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              {/* Pet info */}
              <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">寵物</span>
                  <span className="font-medium">{selected.petName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">品種</span>
                  <span>{selected.petBreed}</span>
                </div>
                {selected.petNotes && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">寵物備註</span>
                    <span className="text-right max-w-[180px]">{selected.petNotes}</span>
                  </div>
                )}
              </div>

              {/* Customer info */}
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">飼主</span>
                  <span className="font-medium">{selected.customerName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">聯絡電話</span>
                  <a href={`tel:${selected.customerPhone}`} className="flex items-center gap-1 text-blue-600 font-medium">
                    <Phone className="h-3 w-3" />
                    {selected.customerPhone}
                  </a>
                </div>
              </div>

              {/* Stay info */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">入住</span>
                  <span>{new Date(selected.checkIn).toLocaleDateString("zh-TW")}</span>
                </div>
                {selected.checkOut && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">預計退房</span>
                    <span>{new Date(selected.checkOut).toLocaleDateString("zh-TW")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">日費</span>
                  <span>NT${selected.dailyRate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">狀態</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    selected.status === "STAYING" ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-600"
                  }`}>
                    {selected.status === "STAYING" ? "住宿中" : selected.status === "CHECKED_OUT" ? "已退房" : selected.status}
                  </span>
                </div>
                {selected.notes && (
                  <div className="pt-1 border-t border-gray-100">
                    <p className="text-gray-500 text-xs mb-1">備註</p>
                    <p className="text-gray-700">{selected.notes}</p>
                  </div>
                )}
              </div>

              {/* Daily logs */}
              <div className="border-t border-gray-100 pt-3">
                <p className="font-medium text-gray-700 mb-2">每日護理記錄</p>

                {/* Add log */}
                <div className="rounded-xl border border-gray-200 p-3 space-y-2 mb-3">
                  <select
                    value={newLog.condition}
                    onChange={e => setNewLog(p => ({ ...p, condition: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {["良好", "活潑", "食慾正常", "食慾不佳", "輕微不適", "需注意"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <Textarea
                    placeholder="餵食/護理/狀況說明（選填）..."
                    value={newLog.note}
                    onChange={e => setNewLog(p => ({ ...p, note: e.target.value }))}
                    rows={2}
                    className="text-sm"
                  />
                  <Button size="sm" onClick={handleAddLog} disabled={submitting} className="w-full">
                    {submitting ? "記錄中..." : "新增今日記錄"}
                  </Button>
                </div>

                {logsLoading ? (
                  <p className="text-xs text-gray-400 text-center py-2">載入中...</p>
                ) : logs.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">尚無護理記錄</p>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="rounded-lg bg-gray-50 border border-gray-100 p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                            log.condition === "良好" || log.condition === "活潑" ? "bg-green-50 text-green-700" :
                            log.condition === "食慾不佳" || log.condition === "輕微不適" ? "bg-amber-50 text-amber-700" :
                            log.condition === "需注意" ? "bg-red-50 text-red-700" :
                            "bg-blue-50 text-blue-700"
                          }`}>
                            {log.condition}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(log.date).toLocaleDateString("zh-TW")}
                            {log.staff && ` · ${log.staff.name}`}
                          </span>
                        </div>
                        {log.note && <p className="text-xs text-gray-600">{log.note}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
