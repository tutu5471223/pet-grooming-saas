"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, parseFeeRates, type FeeRates } from "@/lib/payment-fee"

export function PaymentFeeSettings({ shopId, initialRates }: { shopId: string; initialRates: string | null }) {
  const router = useRouter()
  const [rates, setRates] = useState<FeeRates>(parseFeeRates(initialRates))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")
  const [isError, setIsError] = useState(false)

  async function save() {
    setSaving(true)
    setMsg("")
    setIsError(false)
    try {
      const res = await fetch(`/api/shops/${shopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentFeeRates: rates }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || "儲存失敗")
      }
      setMsg("已儲存")
      router.refresh()
      setTimeout(() => setMsg(""), 3000)
    } catch (e) {
      setIsError(true)
      setMsg(e instanceof Error ? e.message : "儲存失敗")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">付款方式手續費設定</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500">
          設定各付款方式的手續費率（%）。收款時系統會依此自動計算手續費與實收淨額，
          並自動產生一筆「平台手續費」支出，方便營收與支出報表統計。現金通常設 0。
        </p>
        <div className="space-y-3 max-w-sm">
          {PAYMENT_METHODS.map((m) => (
            <div key={m} className="flex items-center justify-between gap-4">
              <Label className="w-24 shrink-0">{PAYMENT_METHOD_LABELS[m]}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={rates[m]}
                  onChange={(e) => setRates((r) => ({ ...r, [m]: Number(e.target.value) }))}
                  className="w-28 text-right"
                />
                <span className="text-sm text-gray-500 w-4">%</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={save} disabled={saving}>{saving ? "儲存中..." : "儲存"}</Button>
          {msg && <span className={`text-sm ${isError ? "text-red-600" : "text-green-600"}`}>{msg}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
