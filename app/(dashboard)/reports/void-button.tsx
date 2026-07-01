"use client"

import { useState } from "react"
import { Ban } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Props {
  paymentId: string
  amount: number
  customerName: string
}

export function VoidButton({ paymentId, amount, customerName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function confirmVoid() {
    setLoading(true)
    try {
      const res = await fetch(`/api/receivables/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VOIDED" }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || "作廢失敗，請稍後再試")
        return
      }
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="作廢"
        className="flex items-center gap-1 rounded-lg bg-orange-50 border border-orange-200 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
      >
        <Ban className="h-3.5 w-3.5" />
        作廢
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認作廢</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-600 space-y-3">
            <p>確定要作廢這筆帳款嗎？</p>
            <div className="rounded-lg bg-gray-50 p-3 space-y-1">
              <p><span className="text-gray-500">客人：</span>{customerName}</p>
              <p><span className="text-gray-500">金額：</span>{formatCurrency(amount)}</p>
            </div>
            <p className="text-orange-600">作廢後不列入營收計算，但紀錄將保留供查核。</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmVoid} disabled={loading}>
              {loading ? "作廢中..." : "確認作廢"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
