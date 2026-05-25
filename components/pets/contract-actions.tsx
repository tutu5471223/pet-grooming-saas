"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Check, RefreshCw, Plus, CheckCircle2, Clock, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QRCodeSVG } from "qrcode.react"
import { contractStatusLabel, formatDateTime } from "@/lib/utils"

interface ContractData {
  id: string
  status: string
  token: string
  signedAt: string | null
  signerName: string | null
}

interface ContractActionsProps {
  petId: string
  contract: ContractData | null
  baseUrl: string
}

export function ContractActions({ petId, contract, baseUrl }: ContractActionsProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const cs = contractStatusLabel(contract?.status ?? "PENDING")
  const signUrl = contract ? `${baseUrl}/contract/${contract.token}` : ""
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(signUrl)}`

  async function handleCopy() {
    await navigator.clipboard.writeText(signUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCreate() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/pets/${petId}/contracts/create`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "建立失敗")
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "建立失敗")
    } finally {
      setLoading(false)
    }
  }

  async function handleRenew() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/pets/${petId}/contracts/renew`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "重新建立失敗")
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "重新建立失敗")
    } finally {
      setLoading(false)
    }
  }

  // No contract at all
  if (!contract) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-gray-500">此寵物尚未建立合約</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button size="sm" onClick={handleCreate} disabled={loading}>
          <Plus className="h-4 w-4" />
          {loading ? "建立中..." : "建立合約"}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status row */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50">
        {contract.status === "SIGNED" ? (
          <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
        ) : contract.status === "EXPIRED" ? (
          <XCircle className="h-8 w-8 text-red-500 shrink-0" />
        ) : (
          <Clock className="h-8 w-8 text-yellow-500 shrink-0" />
        )}
        <div className="flex-1">
          <span className={`font-semibold ${cs.color} rounded-full px-2.5 py-1 inline-block`}>
            {cs.label}
          </span>
          {contract.signedAt && (
            <p className="text-sm text-gray-600 mt-1">
              簽署時間：{formatDateTime(contract.signedAt)}
              {contract.signerName && ` · 簽署人：${contract.signerName}`}
            </p>
          )}
        </div>
        {contract.status === "SIGNED" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRenew}
            disabled={loading}
            className="shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
            {loading ? "處理中..." : "重新發送合約"}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Share section — shown for PENDING and EXPIRED */}
      {contract.status !== "SIGNED" && (
        <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50 p-4 space-y-3">
          <p className="text-sm font-medium text-indigo-800">發送簽署連結給客人</p>

          <code className="block w-full rounded-lg bg-white border border-indigo-200 px-3 py-1.5 text-xs text-gray-700 break-all">
            {signUrl}
          </code>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 bg-white"
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
            <a href={lineUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-white border-green-500 text-green-600 hover:bg-green-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.630 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                用 LINE 傳送
              </Button>
            </a>
          </div>

          <p className="text-xs text-indigo-600">客人可用手機或電腦開啟此連結線上閱讀並簽署</p>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-indigo-200">
            <p className="text-xs text-indigo-600">或掃描 QR Code 開啟簽署頁面</p>
            <div className="rounded-xl border border-indigo-200 bg-white p-3">
              <QRCodeSVG value={signUrl} size={150} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
