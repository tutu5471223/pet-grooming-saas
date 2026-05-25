"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Scissors, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function RegisteredAlert() {
  const searchParams = useSearchParams()
  if (searchParams.get("registered") !== "true") return null
  return (
    <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-700 mb-4">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      註冊成功！請使用您的帳號登入。
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [form, setForm] = useState({
    shopId: "",
    email: "",
    password: "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      shopId: form.shopId,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("帳號、密碼或店家 ID 不正確，請確認後重試")
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg">
            <Scissors className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">寵物美容管理系統</h1>
          <p className="mt-1 text-sm text-gray-500">登入您的管理後台</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
          <Suspense>
            <RegisteredAlert />
          </Suspense>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="shopId">店家 ID</Label>
              <Input
                id="shopId"
                placeholder="請輸入店家 ID"
                value={form.shopId}
                onChange={(e) => setForm({ ...form, shopId: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">電子郵件</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">密碼</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="請輸入密碼"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading} size="lg">
              {loading ? "登入中..." : "登入"}
            </Button>
          </form>

        </div>

        <p className="mt-5 text-center text-sm text-gray-500">
          還沒有帳號？{" "}
          <Link href="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">
            立即註冊
          </Link>
        </p>

        <p className="mt-3 text-center text-sm text-gray-500">
          想了解方案功能？{" "}
          <Link href="/pricing" className="text-indigo-600 hover:text-indigo-700 font-medium">
            查看定價方案
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-gray-400">
          © 2026 PetGroomPro · 保留所有權利
        </p>
      </div>
    </div>
  )
}
