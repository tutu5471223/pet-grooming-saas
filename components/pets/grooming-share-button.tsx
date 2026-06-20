"use client"

import { useState } from "react"
import { Share2, Copy, Check, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { QRCodeSVG } from "qrcode.react"

interface GroomingShareButtonProps {
  groomingRecordId: string
  viewToken: string
  petName: string
  baseUrl: string
}

export function GroomingShareButton({ groomingRecordId, viewToken, petName, baseUrl }: GroomingShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [lineSending, setLineSending] = useState(false)
  const [lineResult, setLineResult] = useState<"success" | "error" | null>(null)
  const [lineError, setLineError] = useState("")

  const url = `${baseUrl}/grooming/${viewToken}`
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(url)}`

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleLinePush() {
    setLineSending(true)
    setLineResult(null)
    setLineError("")
    try {
      const res = await fetch(`/api/grooming/${groomingRecordId}/notify`, { method: "POST" })
      if (res.ok) {
        setLineResult("success")
      } else {
        const data = await res.json().catch(() => ({}))
        setLineError(data.error ?? "LINE 推播失敗")
        setLineResult("error")
      }
    } catch {
      setLineError("網路錯誤，請重試")
      setLineResult("error")
    } finally {
      setLineSending(false)
    }
  }

  function handleOpen() {
    setOpen(true)
    setLineResult(null)
    setLineError("")
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
      >
        <Share2 className="h-3 w-3" />
        傳送完工通知
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>傳送完工通知 — {petName}</DialogTitle>
            <DialogDescription>自動推播 LINE 或複製連結傳給客人</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Auto LINE push */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
              <p className="text-sm font-medium text-gray-800">自動傳送 LINE 訊息</p>
              <p className="text-xs text-gray-500">點擊後系統直接推播給客人的 LINE，無需手動操作</p>
              <Button
                onClick={handleLinePush}
                disabled={lineSending || lineResult === "success"}
                className="w-full bg-green-500 hover:bg-green-600 text-white"
                size="sm"
              >
                {lineSending ? (
                  "傳送中..."
                ) : lineResult === "success" ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    已傳送成功
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    傳送 LINE 通知
                  </>
                )}
              </Button>
              {lineResult === "error" && (
                <p className="text-xs text-red-600">{lineError}</p>
              )}
            </div>

            {/* URL display */}
            <div className="space-y-2">
              <p className="text-sm text-gray-600">完工報告連結</p>
              <code className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 break-all">
                {url}
              </code>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    已複製
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    複製連結
                  </>
                )}
              </Button>
              <a
                href={lineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-green-500 text-green-600 hover:bg-green-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.630 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                  手動 LINE 分享
                </Button>
              </a>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">或掃描 QR Code</p>
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <QRCodeSVG value={url} size={160} />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
