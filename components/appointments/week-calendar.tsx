"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format, startOfWeek, addDays } from "date-fns"
import { zhTW } from "date-fns/locale"
import Link from "next/link"
import { Trash2 } from "lucide-react"
import { formatCurrency, appointmentStatusLabel } from "@/lib/utils"
import { AppointmentActions } from "@/components/appointments/appointment-actions"

interface Appointment {
  id: string
  scheduledAt: string | Date
  duration: number | null
  status: string
  type: string
  services: string | null
  estimatedCost: number | null
  pet: { id: string; name: string; customer: { id: string; name: string } }
  staff?: { id: string; name: string } | null
}

const STAFF_COLORS = [
  "bg-indigo-100 border-indigo-400 text-indigo-900",
  "bg-purple-100 border-purple-400 text-purple-900",
  "bg-green-100 border-green-400 text-green-900",
  "bg-pink-100 border-pink-400 text-pink-900",
  "bg-orange-100 border-orange-400 text-orange-900",
  "bg-teal-100 border-teal-400 text-teal-900",
]

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8–20

interface Props {
  appointments: Appointment[]
  weekStart: Date
}

export function WeekCalendar({ appointments, weekStart }: Props) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ? (appointments.find((a) => a.id === selectedId) ?? null) : null

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除此預約？此操作無法復原。")) return
    await fetch(`/api/appointments/${id}`, { method: "DELETE" })
    setSelectedId(null)
    router.refresh()
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Build staff color map
  const staffIds: string[] = []
  appointments.forEach((a) => {
    if (a.staff && !staffIds.includes(a.staff.id)) staffIds.push(a.staff.id)
  })
  const staffColorMap: Record<string, string> = {}
  staffIds.forEach((id, i) => {
    staffColorMap[id] = STAFF_COLORS[i % STAFF_COLORS.length]
  })

  function getApptStyle(appt: Appointment) {
    const start = new Date(appt.scheduledAt)
    const minutesSince8 = (start.getHours() - 8) * 60 + start.getMinutes()
    const duration = appt.duration ?? 60
    const top = (minutesSince8 / 60) * 56 // 56px per hour
    const height = Math.max(24, (duration / 60) * 56)
    return { top, height }
  }

  function getApptColor(appt: Appointment) {
    if (appt.staff?.id && staffColorMap[appt.staff.id]) return staffColorMap[appt.staff.id]
    return "bg-gray-100 border-gray-400 text-gray-900"
  }

  return (
    <div className="space-y-3">
      {/* Staff color legend */}
      {staffIds.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {staffIds.map((id, i) => (
            <span key={id} className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${STAFF_COLORS[i % STAFF_COLORS.length]}`}>
              {appointments.find((a) => a.staff?.id === id)?.staff?.name ?? "—"}
            </span>
          ))}
          <span className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-100 text-gray-700 px-2 py-0.5">未指定</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-8 border-b border-gray-200">
            <div className="py-2 text-xs text-gray-400 text-center" />
            {days.map((day) => (
              <div key={day.toISOString()} className="py-2 text-center">
                <p className="text-xs text-gray-500">{["日", "一", "二", "三", "四", "五", "六"][day.getDay()]}</p>
                <p className={`text-sm font-bold ${format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "text-indigo-600" : "text-gray-900"}`}>
                  {format(day, "M/d")}
                </p>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="relative grid grid-cols-8" style={{ height: `${HOURS.length * 56}px` }}>
            {/* Hour labels */}
            <div className="flex flex-col">
              {HOURS.map((h) => (
                <div key={h} style={{ height: 56 }} className="flex items-start justify-end pr-2 pt-1">
                  <span className="text-xs text-gray-400">{h}:00</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, dayIdx) => {
              const dayStr = format(day, "yyyy-MM-dd")
              const dayAppts = appointments.filter(
                (a) => format(new Date(a.scheduledAt), "yyyy-MM-dd") === dayStr
              )
              return (
                <div key={dayStr} className="relative border-l border-gray-100">
                  {/* Hour grid lines */}
                  {HOURS.map((h) => (
                    <div key={h} style={{ height: 56, top: (h - 8) * 56 }} className="absolute w-full border-t border-gray-100" />
                  ))}

                  {/* Appointments */}
                  {dayAppts.map((appt) => {
                    const { top, height } = getApptStyle(appt)
                    const color = getApptColor(appt)
                    return (
                      <button
                        key={appt.id}
                        onClick={() => setSelectedId(selectedId === appt.id ? null : appt.id)}
                        className={`absolute left-0.5 right-0.5 rounded border-l-2 px-1 py-0.5 text-left text-xs overflow-hidden transition-shadow hover:shadow-md ${color}`}
                        style={{ top, height }}
                      >
                        <p className="font-semibold truncate leading-tight">{appt.pet.name}</p>
                        <p className="truncate leading-tight opacity-75">{appt.pet.customer.name}</p>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Detail popover */}
      {selected && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="font-bold text-gray-900">
              <Link
                href={`/customers/${selected.pet.customer.id}/pets/${selected.pet.id}`}
                className="hover:text-indigo-600 hover:underline"
              >
                {selected.pet.name}
              </Link>
              {" "}
              <span className="font-normal text-gray-500">({selected.pet.customer.name})</span>
            </p>
            <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600 text-xs">關閉</button>
          </div>
          <p className="text-gray-600">{format(new Date(selected.scheduledAt), "MM/dd HH:mm")}・{selected.duration ?? 60}分鐘</p>
          {selected.staff && <p className="text-gray-600">美容師：{selected.staff.name}</p>}
          {selected.services && (() => {
            try {
              const svcs = JSON.parse(selected.services) as { name: string }[]
              return <p className="text-gray-600">{svcs.map(s => s.name).join("、")}</p>
            } catch { return null }
          })()}
          {selected.estimatedCost && <p className="font-semibold text-gray-900">{formatCurrency(selected.estimatedCost)}</p>}
          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
            <span className={`inline-flex text-xs rounded-full px-2 py-0.5 ${appointmentStatusLabel(selected.status).color}`}>
              {appointmentStatusLabel(selected.status).label}
            </span>
            <AppointmentActions appointmentId={selected.id} currentStatus={selected.status} />
            <button
              onClick={() => handleDelete(selected.id)}
              className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
            >
              <Trash2 className="h-3 w-3" />
              刪除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
