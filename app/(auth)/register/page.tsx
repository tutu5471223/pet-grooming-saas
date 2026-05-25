"use client"

import { useState } from "react"
import Link from "next/link"
import { Scissors, Eye, EyeOff, AlertCircle, CheckCircle2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const TAIWAN_CITIES = [
  "台北市","新北市","桃園市","台中市","台南市","高雄市",
  "基隆市","新竹市","嘉義市","新竹縣","苗栗縣","彰化縣",
  "南投縣","雲林縣","嘉義縣","屏東縣","宜蘭縣","花蓮縣",
  "台東縣","澎湖縣","金門縣","連江縣",
]

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [terms, setTerms] = useState(false)
  const [success, setSuccess] = useState<{ shopId: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({
    shopName: "",
    ownerName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    city: "",
    address: "",
  })

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function copyShopId(id: string) {
    navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (form.password !== form.confirmPassword) { setError("兩次密碼輸入不一致"); return }
    if (form.password.length < 8) { setError("密碼至少需要 8 個字元"); return }
    if (!terms) { setError("請勾選同意服務條款"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, terms }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "註冊失敗")
      setSuccess({ shopId: data.shopId })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "註冊失敗，請稍後再試")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">申請已送出！</h2>
            <p className="text-sm text-gray-500 mb-6">
              我們已收到您的店家申請，審核通過後將以 Email 通知您。
            </p>

            <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4 mb-6 text-left">
              <p className="text-xs text-indigo-600 font-medium mb-1">請記下您的店家 ID（登入時需要）</p>
              <div className="flex items-center gap-2">
                <span className="flex-1 font-mono text-base font-bold text-indigo-800">
                  {success.shopId}
                </span>
                <button
                  onClick={() => copyShopId(success.shopId)}
                  className="shrink-0 rounded-lg border border-indigo-200 bg-white p-1.5 hover:bg-indigo-50 transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-indigo-500" />}
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-5">
              審核通過後，使用店家 ID + Email + 密碼登入系統
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">前往登入頁面</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg">
            <Scissors className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">申請開通店家</h1>
          <p className="mt-1 text-sm text-gray-500">填寫資料後等待審核，免費開始使用</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="shopName">店名 <span className="text-red-500">*</span></Label>
              <Input id="shopName" placeholder="例：毛毛寵物美容" value={form.shopName} onChange={(e) => set("shopName", e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ownerName">負責人姓名 <span className="text-red-500">*</span></Label>
                <Input id="ownerName" placeholder="王小明" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">手機號碼 <span className="text-red-500">*</span></Label>
                <Input id="phone" placeholder="0912-345-678" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">縣市</Label>
                <select
                  id="city"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">請選擇</option>
                  {TAIWAN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">地址</Label>
                <Input id="address" placeholder="市區路號" value={form.address} onChange={(e) => set("address", e.target.value)} />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-3">管理員帳號（登入用）</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                  <Input id="email" type="email" placeholder="owner@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">密碼 <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input id="password" type={showPw ? "text" : "password"} placeholder="至少 8 個字元" minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} required className="pr-10" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowPw(!showPw)}>
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">確認密碼 <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input id="confirmPassword" type={showConfirm ? "text" : "password"} placeholder="再次輸入密碼" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} required className="pr-10" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowConfirm(!showConfirm)}>
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-600">
                我已閱讀並同意{" "}
                <Link href="/terms" className="text-indigo-600 hover:underline" target="_blank">服務條款</Link>
                {" "}及{" "}
                <Link href="/privacy" className="text-indigo-600 hover:underline" target="_blank">隱私政策</Link>
              </span>
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading} size="lg">
              {loading ? "送出申請中..." : "送出申請"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            已有帳號？{" "}
            <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">前往登入</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
