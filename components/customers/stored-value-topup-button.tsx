"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const METHODS = [
  { value: "CASH", label: "現金" },
  { value: "CARD", label: "刷卡" },
]

export function StoredValueTopupButton({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ amount: "", method: "CASH", notes: "" })

  function handleClose() {
    setOpen(false)
    setError("")
    setForm({ amount: "", method: "CASH", notes: "" })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!amount || amount < 100) {
      setError("充值金額最低 100 元")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/customers/${customerId}/stored-value`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method: form.method, notes: form.notes }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "充值失敗")
      }
      handleClose()
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "充值失敗")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        立即充值
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>儲值充值</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="sv-amount">充值金額（最低 $100）</Label>
              <Input
                id="sv-amount"
                type="number"
                min={100}
                step={100}
                placeholder="例：500"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>付款方式</Label>
              <div className="flex gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setForm({ ...form, method: m.value })}
                    className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                      form.method === m.value
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-notes">備註</Label>
              <Input
                id="sv-notes"
                placeholder="選填"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "處理中..." : "確認充值"}
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
