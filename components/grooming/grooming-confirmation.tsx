"use client"

import { useRef, useState } from "react"
import SignatureCanvas from "react-signature-canvas"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/utils"

interface GroomingConfirmationProps {
  groomingId: string
  confirmedAt: string | null
  signatureUrl?: string | null
}

export function GroomingConfirmation({ groomingId, confirmedAt, signatureUrl }: GroomingConfirmationProps) {
  const sigRef = useRef<SignatureCanvas>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState<string | null>(confirmedAt)
  const [savedSignature, setSavedSignature] = useState<string | null>(signatureUrl ?? null)
  const [error, setError] = useState("")

  async function handleConfirm() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setError("請先在簽名欄簽名")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const signature = sigRef.current.toDataURL("image/png")
      const res = await fetch(`/api/grooming/${groomingId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "確認失敗")
      }
      const data = await res.json()
      setConfirmed(data.customerConfirmedAt)
      setSavedSignature(signature)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "確認失敗，請重試")
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmed) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">已確認簽收</p>
            <p className="text-sm text-green-600">
              簽收時間：{formatDateTime(new Date(confirmed))}
            </p>
          </div>
        </div>
        {savedSignature && (
          <div>
            <p className="text-xs text-green-700 mb-1">客人手寫簽名：</p>
            <div className="rounded-xl border border-green-200 bg-white overflow-hidden inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={savedSignature} alt="客人簽名" className="max-w-[240px] h-auto" />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-1">客人簽名確認</p>
        <p className="text-xs text-gray-500">請在下方空白區域簽名，確認已收到寵物並了解本次美容狀況</p>
      </div>

      <div className="rounded-xl border border-gray-300 bg-gray-50 overflow-hidden">
        <SignatureCanvas
          ref={sigRef}
          penColor="#1a1a1a"
          canvasProps={{
            width: 600,
            height: 200,
            style: { width: "100%", height: "160px", touchAction: "none", display: "block" },
          }}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => sigRef.current?.clear()}
          disabled={submitting}
        >
          清除重簽
        </Button>
        <Button
          type="button"
          size="sm"
          className="flex-1 bg-green-600 hover:bg-green-700"
          onClick={handleConfirm}
          disabled={submitting}
        >
          {submitting ? "確認中..." : "確認簽收"}
        </Button>
      </div>
    </div>
  )
}
