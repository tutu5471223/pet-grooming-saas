"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface DeletePetButtonProps {
  petId: string
  customerId: string
  petName: string
  /** 是否有美容紀錄或預約 — 有的話刪除前額外提醒。 */
  hasRecords: boolean
}

export function DeletePetButton({ petId, customerId, petName, hasRecords }: DeletePetButtonProps) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  async function handleDelete() {
    setDeleting(true)
    setError("")
    try {
      const res = await fetch(`/api/pets/${petId}`, { method: "DELETE" })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "刪除失敗") }
      router.push(`/customers/${customerId}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "刪除失敗")
      setDeleting(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-red-600 border-red-200 hover:bg-red-50"
        onClick={() => { setShowConfirm(true); setError("") }}
      >
        <Trash2 className="h-4 w-4" />
        刪除寵物
      </Button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>刪除寵物「{petName}」</DialogTitle>
            <DialogDescription>
              {hasRecords
                ? "此寵物有美容紀錄/預約，確定要刪除嗎？"
                : "確定要刪除嗎？"}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="destructive" className="flex-1" disabled={deleting} onClick={handleDelete}>
              {deleting ? "刪除中..." : "確認刪除"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>取消</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
