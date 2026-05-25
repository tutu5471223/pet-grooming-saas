"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Scissors, CheckCircle2, ArrowRight, Clock, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, "0")
  const m = i % 2 === 0 ? "00" : "30"
  return `${h}:${m}`
})

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [shopForm, setShopForm] = useState({
    businessHoursStart: "09:00",
    businessHoursEnd: "18:00",
    logoUrl: "",
  })

  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    password: "",
  })

  async function handleShopStep(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/onboarding/shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessHoursStart: shopForm.businessHoursStart,
          businessHoursEnd: shopForm.businessHoursEnd,
          logoUrl: shopForm.logoUrl || null,
        }),
      })
      if (!res.ok) throw new Error("儲存失敗")
      setStep(2)
    } catch {
      setError("儲存失敗，請再試一次")
    } finally {
      setLoading(false)
    }
  }

  async function handleStaffStep(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      if (staffForm.name) {
        const res = await fetch("/api/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: staffForm.name,
            role: "STAFF",
            email: staffForm.email || null,
            password: staffForm.password || null,
          }),
        })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error || "新增員工失敗")
        }
      }
      await completeOnboarding()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "操作失敗")
      setLoading(false)
    }
  }

  async function completeOnboarding() {
    await fetch("/api/onboarding/complete", { method: "POST" })
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-10">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg">
            <Scissors className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">歡迎使用！完成初始設定</h1>
          <p className="mt-1 text-sm text-gray-500">只需兩個步驟即可開始使用系統</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-8 px-4">
          {[1, 2].map((s) => (
            <div key={s} className={`flex items-center gap-2 flex-1 ${s > 1 ? "justify-end" : ""}`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                step > s ? "bg-green-500 text-white" : step === s ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"
              }`}>
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              <span className={`text-sm font-medium ${step === s ? "text-gray-900" : "text-gray-400"}`}>
                {s === 1 ? "店家資料" : "新增員工"}
              </span>
              {s < 2 && <div className={`flex-1 h-0.5 ${step > s ? "bg-green-400" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
          {step === 1 && (
            <form onSubmit={handleShopStep} className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-gray-900">步驟一：店家資料</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>開始營業時間</Label>
                  <select
                    value={shopForm.businessHoursStart}
                    onChange={(e) => setShopForm((f) => ({ ...f, businessHoursStart: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>結束營業時間</Label>
                  <select
                    value={shopForm.businessHoursEnd}
                    onChange={(e) => setShopForm((f) => ({ ...f, businessHoursEnd: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="logoUrl">店家 Logo 網址（選填）</Label>
                <Input
                  id="logoUrl"
                  type="url"
                  placeholder="https://..."
                  value={shopForm.logoUrl}
                  onChange={(e) => setShopForm((f) => ({ ...f, logoUrl: e.target.value }))}
                />
                <p className="text-xs text-gray-400">日後可在系統設定中更新</p>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading ? "儲存中..." : <>下一步 <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStaffStep} className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-gray-900">步驟二：新增第一位員工</h2>
              </div>
              <p className="text-sm text-gray-500">若目前只有自己，可直接略過此步驟。</p>

              <div className="space-y-1.5">
                <Label htmlFor="staffName">員工姓名</Label>
                <Input id="staffName" placeholder="美容師姓名" value={staffForm.name} onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staffEmail">Email（登入用，選填）</Label>
                <Input id="staffEmail" type="email" placeholder="staff@example.com" value={staffForm.email} onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              {staffForm.email && (
                <div className="space-y-1.5">
                  <Label htmlFor="staffPw">密碼（至少 8 字元，含英數）</Label>
                  <Input id="staffPw" type="password" placeholder="Password1" value={staffForm.password} onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))} />
                </div>
              )}

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-3">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "處理中..." : staffForm.name ? "新增員工並完成" : "略過，直接完成"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
