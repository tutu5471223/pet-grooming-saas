"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"

export function MarkPaidButton({ paymentId }: { paymentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      await fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID", paidAt: new Date().toISOString() }),
      })
      router.refresh()
    } catch {
      alert("操作失敗，請稍後再試")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      {loading ? "處理中..." : "標記已付款"}
    </button>
  )
}
