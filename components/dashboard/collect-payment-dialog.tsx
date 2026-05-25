"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"
import { CheckCircle2, Wallet, PackageCheck, CreditCard, Banknote } from "lucide-react"

const BILLING_TYPES = [
  { value: "SINGLE", label: "單次收款", icon: Banknote, desc: "現金／刷卡／轉帳／LINE Pay" },
  { value: "MONTHLY_PLAN", label: "使用包月方案", icon: PackageCheck, desc: "套用現有包月次數" },
  { value: "NEW_MONTHLY_PLAN", label: "新建包月方案", icon: PackageCheck, desc: "建立新方案並套用首次" },
  { value: "CREDIT", label: "儲值金扣款", icon: Wallet, desc: "從儲值餘額扣除" },
]

const PAYMENT_METHODS = [
  { value: "CASH", label: "現金" },
  { value: "CARD", label: "刷卡" },
  { value: "TRANSFER", label: "轉帳" },
  { value: "LINE_PAY", label: "LINE Pay" },
]

interface Props {
  paymentId: string
  amount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CollectPaymentDialog({ paymentId, amount, open, onOpenChange }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [billingType, setBillingType] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [planData, setPlanData] = useState({
    name: "",
    maxSessions: 4,
    pricePerSession: 0,
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function reset() {
    setStep(1)
    setBillingType("")
    setPaymentMethod("")
    setError("")
  }

  function handleClose(open: boolean) {
    if (!open) reset()
    onOpenChange(open)
  }

  function handleBillingNext() {
    if (!billingType) { setError("請選擇計費方式"); return }
    if (billingType === "SINGLE" || billingType === "NEW_MONTHLY_PLAN") {
      setError("")
      setStep(2)
    } else {
      handleCollect()
    }
  }

  async function handleCollect() {
    setError("")
    setLoading(true)
    try {
      const body: Record<string, unknown> = { billingType }
      if (billingType === "SINGLE" || billingType === "NEW_MONTHLY_PLAN") {
        if (!paymentMethod) { setError("請選擇付款方式"); setLoading(false); return }
        body.paymentMethod = paymentMethod
      }
      if (billingType === "NEW_MONTHLY_PLAN") {
        if (!planData.name.trim() || planData.pricePerSession <= 0) {
          setError("請填寫方案名稱與每次金額")
          setLoading(false)
          return
        }
        body.monthlyPlanData = planData
      }

      const res = await fetch(`/api/payments/${paymentId}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "收款失敗")
      }
      onOpenChange(false)
      reset()
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "收款失敗")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>收款</DialogTitle>
          <DialogDescription>
            應收金額：<span className="font-semibold text-gray-900">{formatCurrency(amount)}</span>
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 font-medium">選擇計費方式</p>
            <div className="grid grid-cols-2 gap-2">
              {BILLING_TYPES.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setBillingType(t.value)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      billingType === t.value
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-indigo-300"
                    }`}
                  >
                    <Icon className={`h-4 w-4 mb-1.5 ${billingType === t.value ? "text-indigo-600" : "text-gray-500"}`} />
                    <p className={`text-sm font-medium ${billingType === t.value ? "text-indigo-800" : "text-gray-800"}`}>{t.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                  </button>
                )
              })}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => handleClose(false)}>取消</Button>
              <Button onClick={handleBillingNext} disabled={loading}>
                {billingType === "SINGLE" || billingType === "NEW_MONTHLY_PLAN" ? "下一步" : loading ? "處理中..." : "確認收款"}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 font-medium mb-2">選擇付款方式</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value)}
                    className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                      paymentMethod === m.value
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : "border-gray-200 text-gray-700 hover:border-indigo-300"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {billingType === "NEW_MONTHLY_PLAN" && (
              <div className="space-y-3 rounded-xl bg-purple-50 border border-purple-200 p-3">
                <p className="text-sm font-medium text-purple-800">包月方案設定</p>
                <div>
                  <Label className="text-xs">方案名稱</Label>
                  <Input
                    value={planData.name}
                    onChange={(e) => setPlanData((d) => ({ ...d, name: e.target.value }))}
                    placeholder="例：基礎洗澡包月4次"
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">總次數</Label>
                    <Input
                      type="number"
                      min={1}
                      value={planData.maxSessions}
                      onChange={(e) => setPlanData((d) => ({ ...d, maxSessions: Number(e.target.value) }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">每次金額（元）</Label>
                    <Input
                      type="number"
                      min={0}
                      value={planData.pricePerSession || ""}
                      onChange={(e) => setPlanData((d) => ({ ...d, pricePerSession: Number(e.target.value) }))}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">開始日期</Label>
                    <Input
                      type="date"
                      value={planData.startDate}
                      onChange={(e) => setPlanData((d) => ({ ...d, startDate: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">結束日期</Label>
                    <Input
                      type="date"
                      value={planData.endDate}
                      onChange={(e) => setPlanData((d) => ({ ...d, endDate: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => { setStep(1); setError("") }}>上一步</Button>
              <Button onClick={handleCollect} disabled={loading}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                {loading ? "處理中..." : "確認收款"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
