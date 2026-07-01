"use client"

import { useState } from "react"
import { RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  paymentId: string
  originalAmount: number
  refundedAmount: number
}

export function RefundButton({ paymentId, originalAmount, refundedAmount }: Props) {
  const router = useRouter()
  const maxRefundable = Math.round((originalAmount - refundedAmount) * 100) / 100
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(String(maxRefundable))
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function handleOpen() {
    setAmount(String(maxRefundable))
    setReason("")
    setError("")
    setOpen(true)
  }

  async function doRefund() {
    const parsed = Number(amount)
    if (!parsed || parsed <= 0 || parsed > maxRefundable) {
      setError(`退款金額必須介於 1 ~ ${formatCurrency(maxRefundable)} 之間`)
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, ...(reason ? { reason } : {}) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error || "退款失敗，請稍後再試")
        return
      }
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (maxRefundable <= 0) return null

  return (
    <>
      <button
        onClick={handleOpen}
        title="退款"
        className="flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        退款
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>辦理退款</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
              <p>
                <span className="text-gray-500">原始金額：</span>
                <span className="font-semibold">{formatCurrency(originalAmount)}</span>
              </p>
              {refundedAmount > 0 && (
                <p>
                  <span className="text-gray-500">已退款：</span>
                  <span className="text-red-600">{formatCurrency(refundedAmount)}</span>
                </p>
              )}
              <p>
                <span className="text-gray-500">可退款上限：</span>
                <span className="font-semibold text-red-700">{formatCurrency(maxRefundable)}</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">退款金額 *</Label>
              <Input
                type="number"
                min={1}
                max={maxRefundable}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">退款原因（選填）</Label>
              <Input
                placeholder="例：客人取消服務"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button variant="destructive" onClick={doRefund} disabled={loading}>
              {loading ? "處理中..." : "確認退款"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
