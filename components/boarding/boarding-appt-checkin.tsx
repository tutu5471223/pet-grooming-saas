"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogIn } from "lucide-react"

export function BoardingApptCheckin({ appointmentId }: { appointmentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCheckin() {
    if (!confirm("確認辦理入住？")) return
    setLoading(true)
    const res = await fetch(`/api/appointments/${appointmentId}/checkin`, { method: "PATCH" })
    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? "辦理入住失敗")
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCheckin}
      disabled={loading}
      className="shrink-0 border-orange-300 text-orange-700 hover:bg-orange-50"
    >
      <LogIn className="h-4 w-4" />
      {loading ? "辦理中..." : "辦理入住"}
    </Button>
  )
}
