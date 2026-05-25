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
import { LogOut } from "lucide-react"
import { differenceInDays } from "date-fns"
import { formatCurrency } from "@/lib/utils"

interface AddOnService {
  name: string
  price: number
}

interface BoardingCheckoutProps {
  recordId: string
  dailyRate: number
  checkIn: Date | string
  addOnServices?: string | null
  priceAdjustment?: number | null
  priceAdjustmentNote?: string | null
}

export function BoardingCheckout({
  recordId,
  dailyRate,
  checkIn,
  addOnServices,
  priceAdjustment,
  priceAdjustmentNote,
}: BoardingCheckoutProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const now = new Date()
  const days = Math.max(1, differenceInDays(now, new Date(checkIn)))
  const baseCost = days * dailyRate

  const parsedAddOns: AddOnService[] = (() => {
    try { return addOnServices ? JSON.parse(addOnServices) : [] } catch { return [] }
  })()
  const addOnTotal = parsedAddOns.reduce((s, a) => s + a.price, 0)
  const adjustment = priceAdjustment ?? 0
  const totalCost = baseCost + addOnTotal + adjustment

  async function handleCheckout() {
    setLoading(true)
    await fetch(`/api/boarding/${recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "CHECKED_OUT",
        checkOut: now.toISOString(),
      }),
    })
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
        className="shrink-0"
      >
        <LogOut className="h-4 w-4" />
        辦理退房
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認退房 — 費用明細</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
              <div className="flex justify-between text-gray-700">
                <span>基本住宿費（{days} 天 × {formatCurrency(dailyRate)}）</span>
                <span className="font-medium">{formatCurrency(baseCost)}</span>
              </div>

              {parsedAddOns.map((a, i) => (
                <div key={i} className="flex justify-between text-gray-700">
                  <span>附加服務：{a.name}</span>
                  <span className="font-medium">{formatCurrency(a.price)}</span>
                </div>
              ))}

              {adjustment !== 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>
                    費用調整
                    {priceAdjustmentNote && (
                      <span className="text-gray-400 ml-1">（{priceAdjustmentNote}）</span>
                    )}
                  </span>
                  <span className={`font-medium ${adjustment < 0 ? "text-green-600" : "text-red-600"}`}>
                    {adjustment > 0 ? "+" : ""}{formatCurrency(adjustment)}
                  </span>
                </div>
              )}

              <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-900">
                <span>總計</span>
                <span>{formatCurrency(totalCost)}</span>
              </div>
            </div>

            <p className="text-xs text-gray-400">退房後將自動建立付款記錄（現金），並釋放房間。</p>
          </div>

          <div className="flex gap-2 mt-2">
            <Button
              onClick={handleCheckout}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "退房中..." : "確認退房"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              取消
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
