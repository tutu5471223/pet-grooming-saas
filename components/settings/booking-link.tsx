"use client"

import { useRef, useState } from "react"
import { Copy, Check, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react"

interface BookingLinkProps {
  shopId: string
  baseUrl: string
}

export function BookingLink({ shopId, baseUrl }: BookingLinkProps) {
  const [copied, setCopied] = useState(false)
  const [copiedContract, setCopiedContract] = useState(false)
  const contractQrRef = useRef<HTMLDivElement>(null)

  function handleDownloadContractQR() {
    const canvas = contractQrRef.current?.querySelector("canvas")
    if (!canvas) return
    const url = canvas.toDataURL("image/png")
    const a = document.createElement("a")
    a.href = url
    a.download = "contract-qrcode.png"
    a.click()
  }
  const bookingUrl = `${baseUrl}/booking/${shopId}`
  const contractUrl = `${baseUrl}/contract/${shopId}`
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(bookingUrl)}`
  const contractLineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(contractUrl)}`

  async function handleCopy() {
    await navigator.clipboard.writeText(bookingUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopyContract() {
    await navigator.clipboard.writeText(contractUrl)
    setCopiedContract(true)
    setTimeout(() => setCopiedContract(false), 2000)
  }

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle className="text-base">客人自助預約連結</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          將此連結分享給客人，客人可直接在手機上填寫預約申請，無需安裝 APP。
        </p>

        <code className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 break-all">
          {bookingUrl}
        </code>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleCopy}>
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
              className="w-full border-green-500 text-green-600 hover:bg-green-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.630 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              LINE 分享
            </Button>
          </a>
        </div>

        <div className="flex flex-col items-center gap-2 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">或掃描 QR Code 開啟預約頁面</p>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <QRCodeSVG value={bookingUrl} size={160} />
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Contract registration link */}
    <Card>
      <CardHeader>
        <CardTitle className="text-base">新客人合約連結</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          將此連結傳給新客人，客人可直接在手機上完成建檔並簽署定型化合約，無需安裝 APP。
        </p>

        <code className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 break-all">
          {contractUrl}
        </code>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleCopyContract}>
            {copiedContract ? (
              <><Check className="h-4 w-4 text-green-600" />已複製</>
            ) : (
              <><Copy className="h-4 w-4" />複製連結</>
            )}
          </Button>
          <a href={contractLineUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" className="w-full border-green-500 text-green-600 hover:bg-green-50">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.630 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              LINE 分享
            </Button>
          </a>
        </div>

        <div className="flex flex-col items-center gap-2 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">或掃描 QR Code 開啟合約建檔頁面</p>
          <div ref={contractQrRef} className="rounded-xl border border-gray-200 bg-white p-3">
            <QRCodeCanvas value={contractUrl} size={160} />
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadContractQR}>
            <Download className="h-4 w-4" />
            下載 QR Code
          </Button>
        </div>
      </CardContent>
    </Card>
    </div>
  )
}
