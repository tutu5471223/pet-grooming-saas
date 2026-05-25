"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Copy, Check, MessageCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const STATUS_OPTIONS = [
  { value: "PENDING", label: "待確認" },
  { value: "CONFIRMED", label: "已確認" },
  { value: "IN_PROGRESS", label: "進行中" },
  { value: "COMPLETED", label: "已完成" },
  { value: "CANCELLED", label: "已取消" },
  { value: "NO_SHOW", label: "未到店" },
]

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"]

export interface AppointmentNotifyInfo {
  petName: string
  customerName: string
  scheduledAt: string
  services: string | null
  estimatedCost: number | null
  shopName: string
  shopPhone: string | null
}

export function buildNotificationMessage(info: AppointmentNotifyInfo): string {
  const date = new Date(info.scheduledAt)
  const dateStr = `${date.getMonth() + 1}/${date.getDate()}（${WEEKDAYS[date.getDay()]}）${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`

  let svcLine = ""
  try {
    const svcs = JSON.parse(info.services || "[]") as { name: string; price?: number }[]
    svcLine = svcs.map((s) => (s.price ? `${s.name} $${s.price}` : s.name)).join("、")
  } catch {
    svcLine = ""
  }

  const lines = [
    `【${info.shopName}】您好，您的預約已確認！`,
    `📅 時間：${dateStr}`,
    `🐾 寵物：${info.petName}`,
  ]
  if (svcLine) lines.push(`✂️ 服務：${svcLine}`)
  if (info.shopPhone) lines.push(`📞 如需更改請來電：${info.shopPhone}`)
  else lines.push(`📍 如需更改請提前告知，謝謝！`)

  return lines.join("\n")
}

export function AppointmentActions({
  appointmentId,
  currentStatus,
  notifyInfo,
}: {
  appointmentId: string
  currentStatus: string
  notifyInfo?: AppointmentNotifyInfo
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showNotify, setShowNotify] = useState(false)
  const [copied, setCopied] = useState(false)
  const [optimisticStatus, setOptimisticStatus] = useState(currentStatus)

  // Sync when server refreshes the prop
  useEffect(() => { setOptimisticStatus(currentStatus) }, [currentStatus])

  async function updateStatus(status: string) {
    setOptimisticStatus(status)
    setLoading(true)
    await fetch(`/api/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setLoading(false)
    router.refresh()
    if (status === "CONFIRMED" && notifyInfo) setShowNotify(true)
  }

  const notifyMsg = notifyInfo ? buildNotificationMessage(notifyInfo) : ""

  function copyMessage() {
    navigator.clipboard.writeText(notifyMsg)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="relative mt-2 inline-block">
        <select
          value={optimisticStatus}
          onChange={(e) => updateStatus(e.target.value)}
          disabled={loading}
          className="appearance-none rounded-lg border border-gray-200 bg-white py-1 pl-2 pr-7 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
      </div>

      {notifyInfo && (
        <Dialog open={showNotify} onOpenChange={setShowNotify}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>預約已確認 ✅</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-gray-500">複製以下訊息，透過 LINE 通知客人：</p>
              <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700 font-sans leading-relaxed">
                {notifyMsg}
              </pre>
              <div className="flex gap-2">
                <Button onClick={copyMessage} variant="outline" className="flex-1 gap-1.5">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? "已複製" : "複製訊息"}
                </Button>
                <a
                  href={`line://msg/text/${encodeURIComponent(notifyMsg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full bg-[#06C755] hover:bg-[#05b34c] gap-1.5">
                    <MessageCircle className="h-4 w-4" />
                    LINE 傳送
                  </Button>
                </a>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
