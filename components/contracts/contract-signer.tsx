"use client"

import { useRef, useState, useEffect } from "react"
import SignatureCanvas from "react-signature-canvas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, RotateCcw, Pen } from "lucide-react"

export function ContractSigner({
  contractId,
  contractToken,
  customerName,
}: {
  contractId: string
  contractToken: string
  customerName: string
}) {
  const sigRef = useRef<SignatureCanvas>(null)
  const sigContainerRef = useRef<HTMLDivElement>(null)
  const [signerName, setSignerName] = useState(customerName)

  useEffect(() => {
    function resize() {
      const canvas = sigRef.current?.getCanvas()
      const container = sigContainerRef.current
      if (!canvas || !container) return
      canvas.width = container.offsetWidth
      canvas.height = container.offsetHeight
      sigRef.current?.clear()
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [hasSignature, setHasSignature] = useState(false)

  function clearSignature() {
    sigRef.current?.clear()
    setHasSignature(false)
  }

  async function handleSubmit() {
    if (!agreed) {
      setError("請勾選同意條款")
      return
    }
    if (!hasSignature || sigRef.current?.isEmpty()) {
      setError("請先完成手寫簽名")
      return
    }

    setLoading(true)
    setError("")

    const signatureUrl = sigRef.current?.toDataURL("image/png") ?? ""

    try {
      const res = await fetch(`/api/contracts/${contractId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName, signatureUrl, token: contractToken }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "簽署失敗")
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-green-800">簽署完成！</h2>
        <p className="text-sm text-green-700 mt-1">感謝您的配合，合約已成功簽署。</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Pen className="h-4 w-4 text-indigo-600" />
          簽署確認
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          請閱讀完上方合約內容，填寫姓名並手寫簽名
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signerName">簽署人姓名</Label>
        <Input
          id="signerName"
          placeholder="請輸入您的姓名"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>手寫簽名</Label>
          <button
            type="button"
            onClick={clearSignature}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <RotateCcw className="h-3 w-3" />
            清除
          </button>
        </div>
        <div ref={sigContainerRef} className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden" style={{ height: "180px" }}>
          <SignatureCanvas
            ref={sigRef}
            penColor="black"
            canvasProps={{ className: "w-full h-full touch-none block" }}
            onBegin={() => setHasSignature(true)}
          />
        </div>
        <p className="text-xs text-gray-400">請用手指（手機）或滑鼠（電腦）簽名</p>
      </div>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="agreed"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600"
        />
        <label htmlFor="agreed" className="text-sm text-gray-700">
          我已閱讀並同意上述定型化契約的所有條款，確認以上資訊正確無誤。
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full"
        size="lg"
      >
        {loading ? "簽署中..." : "確認簽署"}
      </Button>
    </div>
  )
}
