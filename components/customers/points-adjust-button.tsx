"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const TYPES = [
  { value: "add", label: "加點" },
  { value: "deduct", label: "扣點" },
]

export function PointsAdjustButton({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ type: "add", amount: "", reason: "" })

  function handleClose() {
    setOpen(false)
    setError("")
    setForm({ type: "add", amount: "", reason: "" })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      setError("請輸入有效的正整數點數")
      return
    }
    if (!form.reason.trim()) {
      setError("請填寫調整原因")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/customers/${customerId}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: form.type, amount, reason: form.reason }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "操作失敗")
      }
      handleClose()
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "操作失敗")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="h-4 w-4" />
        調整點數
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手動調整點數</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>操作類型</Label>
              <div className="flex gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm({ ...form, type: t.value })}
                    className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                      form.type === t.value
                        ? t.value === "add"
                          ? "border-green-500 bg-green-600 text-white"
                          : "border-red-500 bg-red-600 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pts-amount">點數數量</Label>
              <Input
                id="pts-amount"
                type="number"
                min={1}
                step={1}
                placeholder="例：50"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pts-reason">原因 *</Label>
              <Input
                id="pts-reason"
                placeholder="例：生日禮遇加點、錯誤扣點補正..."
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "處理中..." : "確認調整"}
              </Button>
              <Button type="button" variant="outline" onClick={handleClose}>
                取消
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
