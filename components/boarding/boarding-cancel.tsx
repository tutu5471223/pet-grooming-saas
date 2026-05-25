"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { XCircle } from "lucide-react"

interface BoardingCancelProps {
  recordId: string
  petName: string
}

export function BoardingCancel({ recordId, petName }: BoardingCancelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    setLoading(true)
    await fetch(`/api/boarding/${recordId}`, { method: "DELETE" })
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="shrink-0 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        <XCircle className="h-4 w-4" />
        取消住宿
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認取消住宿</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            確定要取消 <strong>{petName}</strong> 的住宿嗎？取消後不計費用。
          </p>
          <div className="flex gap-2 mt-4">
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "取消中..." : "確認取消住宿"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              返回
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
