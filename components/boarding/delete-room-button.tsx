"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function DeleteRoomButton({ roomId, roomName }: { roomId: string; roomName: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm(`確定要刪除房間「${roomName}」嗎？此操作無法復原。`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "刪除失敗")
        return
      }
      router.refresh()
    } catch {
      alert("刪除失敗，請再試一次")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="mt-1 flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
      title="刪除房間"
    >
      <Trash2 className="h-3 w-3" />
      {loading ? "刪除中..." : "刪除"}
    </button>
  )
}
