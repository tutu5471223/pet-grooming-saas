"use client"

import { useState } from "react"
import { addDays, startOfWeek, isSameDay, startOfDay } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface WeekRecord {
  id: string
  petName: string
  customerName: string
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

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]

export function BoardingWeekView({
  rooms,
  records,
}: {
  rooms: WeekRoom[]
  records: WeekRecord[]
}) {
  const [selected, setSelected] = useState<WeekRecord | null>(null)

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const days = Array.from({ length: 21 }, (_, i) => addDays(weekStart, i))
  const today = startOfDay(new Date())

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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>住宿詳情</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">寵物</span>
                <span className="font-medium">{selected.petName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">客人</span>
                <span>{selected.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">入住</span>
                <span>
                  {new Date(selected.checkIn).toLocaleDateString("zh-TW")}
                </span>
              </div>
              {selected.checkOut && (
                <div className="flex justify-between">
                  <span className="text-gray-500">預計退房</span>
                  <span>
                    {new Date(selected.checkOut).toLocaleDateString("zh-TW")}
                  </span>
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
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
