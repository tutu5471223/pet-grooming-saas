"use client"

import { useState } from "react"
import { ClipboardList, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DailyLog {
  id: string
  date: string
  condition: string
  note: string | null
  staff: { name: string } | null
}

interface Props {
  boardingRecordId: string
  petName: string
  customerName: string
  checkIn: string
  checkOut: string | null
}

const CONDITION_COLORS: Record<string, string> = {
  良好: "bg-green-50 text-green-700",
  活潑: "bg-green-50 text-green-700",
  食慾正常: "bg-blue-50 text-blue-700",
  食慾不佳: "bg-amber-50 text-amber-700",
  輕微不適: "bg-amber-50 text-amber-700",
  需注意: "bg-red-50 text-red-700",
}

export function BoardingLogsButton({ boardingRecordId, petName, customerName, checkIn, checkOut }: Props) {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  async function handleOpen() {
    setOpen(true)
    if (!fetched) {
      setLoading(true)
      try {
        const res = await fetch(`/api/boarding/${boardingRecordId}/logs`)
        const data = await res.json()
        setLogs(Array.isArray(data) ? data : [])
      } catch {
        setLogs([])
      } finally {
        setLoading(false)
        setFetched(true)
      }
    }
  }

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Taipei",
    }).format(new Date(d))

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
        title="查看護理記錄"
      >
        <ClipboardList className="h-3.5 w-3.5" />
        護理記錄
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900">{petName} 的護理記錄</p>
                <p className="text-xs text-gray-500">
                  {customerName} · 入住 {formatDate(checkIn)}
                  {checkOut ? ` · 退房 ${formatDate(checkOut)}` : ""}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-5">
              {loading ? (
                <p className="text-sm text-gray-400 text-center py-8">載入中...</p>
              ) : logs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">此住宿期間無護理記錄</p>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${CONDITION_COLORS[log.condition] ?? "bg-gray-100 text-gray-700"}`}>
                          {log.condition}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Intl.DateTimeFormat("zh-TW", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            timeZone: "Asia/Taipei",
                          }).format(new Date(log.date))}
                          {log.staff && ` · ${log.staff.name}`}
                        </span>
                      </div>
                      {log.note && <p className="text-sm text-gray-700">{log.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100">
              <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
                關閉
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
