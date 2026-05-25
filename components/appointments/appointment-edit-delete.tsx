"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2 } from "lucide-react"
import { AppointmentEditDialog } from "./appointment-edit-dialog"

interface Props {
  appointment: {
    id: string
    scheduledAt: string
    staffId: string | null
    services: string | null
    estimatedCost: number | null
    duration: number | null
    notes: string | null
    status: string
  }
}

export function AppointmentEditDelete({ appointment }: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)

  async function handleDelete() {
    if (!confirm("確定要刪除此預約？此操作無法復原。")) return
    await fetch(`/api/appointments/${appointment.id}`, { method: "DELETE" })
    router.refresh()
  }

  return (
    <>
      <div className="flex items-center gap-1 mt-1">
        <button
          onClick={() => setEditOpen(true)}
          className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Pencil className="h-3 w-3" />
          編輯
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          刪除
        </button>
      </div>
      <AppointmentEditDialog
        appointment={appointment}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  )
}
