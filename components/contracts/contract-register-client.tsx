"use client"

import { useRef, useState } from "react"
import SignatureCanvas from "react-signature-canvas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, Scissors } from "lucide-react"

interface Props {
  shopId: string
  shopName: string
  contractTemplate: string
}

const GENDER_OPTIONS = [
  { value: "MALE", label: "公" },
  { value: "FEMALE", label: "母" },
  { value: "UNKNOWN", label: "未知" },
]

export function ContractRegisterClient({ shopId, shopName, contractTemplate }: Props) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: "",
    phone: "",
    petName: "",
    species: "犬",
    breed: "",
    gender: "UNKNOWN",
  })
  const [agreed, setAgreed] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const sigRef = useRef<SignatureCanvas>(null)

  function setField(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
    setError("")
  }

  function validateStep1(): string {
    if (!form.name.trim()) return "請填寫姓名"
    if (!/^09\d{8}$/.test(form.phone)) return "手機號碼格式錯誤（09xxxxxxxx）"
    if (!form.petName.trim()) return "請填寫寵物名稱"
    return ""
  }

  function goToStep2() {
    const err = validateStep1()
    if (err) { setError(err); return }
    setError("")
    setStep(2)
  }

  function clearSig() {
    sigRef.current?.clear()
    setHasSignature(false)
  }

  async function handleSubmit() {
    if (!agreed) { setError("請勾選同意條款"); return }
    if (!hasSignature || sigRef.current?.isEmpty()) { setError("請完成手寫簽名"); return }
    setError("")
    setSubmitting(true)
    const signatureUrl = sigRef.current!.toDataURL("image/png")
    try {
      const res = await fetch(`/api/contract/${shopId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone,
          petName: form.petName.trim(),
          species: form.species,
          breed: form.breed.trim() || null,
          gender: form.gender,
          signerName: form.name.trim(),
          signatureUrl,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "送出失敗")
      }
      setStep(3)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "送出失敗")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Scissors className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 truncate">{shopName}</span>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-medium ${
                  s === step ? "bg-indigo-600 text-white" : s < step ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                }`}>{s}</div>
                {s < 3 && <div className="h-px w-3 bg-gray-200" />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

        {/* Step 1 — Basic info */}
        {step === 1 && (
          <>
            <div>
              <h1 className="text-xl font-bold text-gray-900">新客人建檔</h1>
              <p className="text-sm text-gray-500 mt-1">請填寫您與寵物的基本資料</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-700">飼主資料</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs">姓名 *</Label>
                  <Input id="name" placeholder="王小明" value={form.name}
                    onChange={(e) => setField("name", e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs">手機號碼 *</Label>
                  <Input id="phone" type="tel" placeholder="0912345678" value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)} className="h-10" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-700">寵物資料</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="petName" className="text-xs">寵物名稱 *</Label>
                  <Input id="petName" placeholder="小白" value={form.petName}
                    onChange={(e) => setField("petName", e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">寵物種類 *</Label>
                  <div className="flex gap-2">
                    {["犬", "貓", "其他"].map((sp) => (
                      <button key={sp} type="button" onClick={() => setField("species", sp)}
                        className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                          form.species === sp
                            ? "border-indigo-500 bg-indigo-600 text-white"
                            : "border-gray-200 text-gray-600 hover:border-indigo-300"
                        }`}>{sp}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="breed" className="text-xs">品種（選填）</Label>
                  <Input id="breed" placeholder="貴賓、柴犬..." value={form.breed}
                    onChange={(e) => setField("breed", e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">性別</Label>
                  <div className="flex gap-2">
                    {GENDER_OPTIONS.map((g) => (
                      <button key={g.value} type="button" onClick={() => setField("gender", g.value)}
                        className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                          form.gender === g.value
                            ? "border-indigo-500 bg-indigo-600 text-white"
                            : "border-gray-200 text-gray-600 hover:border-indigo-300"
                        }`}>{g.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}

            <Button className="w-full h-11" onClick={goToStep2}>
              下一步：閱讀並簽署合約
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Step 2 — Contract + Signature */}
        {step === 2 && (
          <>
            <button type="button" onClick={() => { setStep(1); setError("") }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ChevronLeft className="h-4 w-4" /> 返回修改資料
            </button>

            <div>
              <h2 className="text-xl font-bold text-gray-900">閱讀並簽署合約</h2>
              <p className="text-sm text-gray-500 mt-1">請仔細閱讀以下定型化契約後簽名</p>
            </div>

            {/* Customer + pet summary */}
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 text-sm">
              <p className="text-indigo-800"><span className="font-medium">飼主：</span>{form.name}（{form.phone}）</p>
              <p className="text-indigo-800 mt-0.5">
                <span className="font-medium">寵物：</span>{form.petName}（{form.breed || form.species}）{form.gender !== "UNKNOWN" ? `・${form.gender === "MALE" ? "公" : "母"}` : ""}
              </p>
            </div>

            {/* Contract content */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              {contractTemplate ? (
                <div className="prose prose-sm max-w-none text-gray-800"
                  dangerouslySetInnerHTML={{ __html: contractTemplate }} />
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">（店家尚未設定合約範本）</p>
              )}
            </div>

            {/* Signature */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">手寫簽名</p>
                <button type="button" onClick={clearSig}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                  <RotateCcw className="h-3 w-3" /> 清除
                </button>
              </div>
              <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden">
                <SignatureCanvas
                  ref={sigRef}
                  penColor="black"
                  canvasProps={{
                    width: 560,
                    height: 180,
                    className: "w-full touch-none",
                    style: { maxWidth: "100%", height: "180px" },
                  }}
                  onBegin={() => setHasSignature(true)}
                />
              </div>
              <p className="text-xs text-gray-400">請用手指（手機）或滑鼠（電腦）在上方框內簽名</p>
            </div>

            {/* Agree checkbox */}
            <div className="flex items-start gap-3">
              <input type="checkbox" id="agreed" checked={agreed}
                onChange={(e) => { setAgreed(e.target.checked); setError("") }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600" />
              <label htmlFor="agreed" className="text-sm text-gray-700">
                我已閱讀並同意上述定型化契約的所有條款，確認以上個人及寵物資訊正確無誤。
              </label>
            </div>

            {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}

            <Button className="w-full h-11" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "送出中..." : "確認送出並完成建檔"}
            </Button>
          </>
        )}

        {/* Step 3 — Success */}
        {step === 3 && (
          <div className="text-center py-10 space-y-5">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">建檔完成！</h2>
              <p className="text-gray-500 mt-2">感謝您完成資料建立與合約簽署</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 text-left space-y-2 text-sm">
              <p className="font-semibold text-gray-700">建檔摘要</p>
              <div className="flex justify-between text-gray-600">
                <span>飼主</span>
                <span className="font-medium text-gray-900">{form.name}（{form.phone}）</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>寵物</span>
                <span className="font-medium text-gray-900">{form.petName}（{form.breed || form.species}）</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>合約</span>
                <span className="font-medium text-green-600">已簽署 ✓</span>
              </div>
            </div>
            <p className="text-sm text-gray-500">如需預約美容服務，請洽店家或使用線上預約連結。</p>
          </div>
        )}
      </div>
    </div>
  )
}
