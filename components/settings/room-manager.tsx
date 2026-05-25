"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

interface Room {
  id: string
  name: string
  type: string | null
  dailyRate: number
  status: string
  notes: string | null
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  OCCUPIED: "bg-orange-100 text-orange-700",
  MAINTENANCE: "bg-red-100 text-red-700",
}
const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "空房",
  OCCUPIED: "使用中",
  MAINTENANCE: "維修中",
}

export function RoomManager({ initialRooms }: { initialRooms: Room[] }) {
  const router = useRouter()
  const [rooms, setRooms] = useState(initialRooms)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", type: "", dailyRate: "" })
  const [loading, setLoading] = useState(false)

  async function addRoom(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        type: form.type || null,
        dailyRate: Number(form.dailyRate),
      }),
    })
    const room = await res.json()
    setRooms([...rooms, room])
    setForm({ name: "", type: "", dailyRate: "" })
    setShowForm(false)
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Home className="h-4 w-4" /> 住宿房間管理
        </CardTitle>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> 新增
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form onSubmit={addRoom} className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">房間名稱 *</Label>
                <Input
                  placeholder="例：1號房"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">類型</Label>
                <Input
                  placeholder="小型/中型/大型"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">每日費用</Label>
                <Input
                  type="number"
                  placeholder="500"
                  value={form.dailyRate}
                  onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
                  required
                  min={0}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "儲存中..." : "儲存"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                取消
              </Button>
            </div>
          </form>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{room.name}</p>
                  {room.type && <p className="text-xs text-gray-500">{room.type}</p>}
                </div>
                <span
                  className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_COLORS[room.status]}`}
                >
                  {STATUS_LABELS[room.status]}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-indigo-600">
                {formatCurrency(room.dailyRate)} / 天
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
