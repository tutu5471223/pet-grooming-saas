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

const PERSONALITY_OPTIONS = ["黏人", "膽小", "親人", "活潑", "易怒", "咬人", "討厭狗狗", "討厭貓咪"]
const BLOW_DRYER_OPTIONS = ["完全接受", "有點怕", "非常怕"]
const AFTER_GROOM_OPTIONS = ["自由落地", "桌上限制活動", "圍片限制活動", "回到自己外出籠", "以上皆可"]

const EMPTY_HEALTH = {
  personality: [] as string[],
  boneIssue: false, boneNote: "",
  skinIssue: false, skinNote: "",
  earIssue: false, earNote: "",
  eyeIssue: false, eyeNote: "",
  heartDisease: false, boneDisease: false, skinDisease: false,
  epilepsy: false, diabetes: false,
  surgeryHistory: false, surgeryNote: "",
  otherDisease: "",
  bathFrequency: "", groomFrequency: "", blowDryerFear: "",
  afterGroomHandle: "", consentPhoto: false, consentSnack: false, snackAllergy: "",
}

type HealthState = typeof EMPTY_HEALTH

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "border-indigo-500 bg-indigo-600 text-white" : "border-gray-200 text-gray-600 hover:border-indigo-300"
      }`}>
      {label}
    </button>
  )
}

function IssueRow({
  label, active, note, onToggle, onNote,
}: { label: string; active: boolean; note: string; onToggle: () => void; onNote: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggle}
          className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${
            active ? "border-red-400 bg-red-500 text-white" : "border-gray-200 text-gray-500"
          }`}>
          {active ? "有問題" : "正常"}
        </button>
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      {active && (
        <Input placeholder="說明..." value={note} onChange={(e) => onNote(e.target.value)} className="h-9 text-sm" />
      )}
    </div>
  )
}

export function ContractRegisterClient({ shopId, shopName, contractTemplate }: Props) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: "", phone: "", petName: "", species: "犬", breed: "", gender: "UNKNOWN",
  })
  const [health, setHealth] = useState<HealthState>(EMPTY_HEALTH)
  const [agreed, setAgreed] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const sigRef = useRef<SignatureCanvas>(null)

  function setField(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
    setError("")
  }

  function setH<K extends keyof HealthState>(k: K, v: HealthState[K]) {
    setHealth((h) => ({ ...h, [k]: v }))
  }

  function togglePersonality(tag: string) {
    setHealth((h) => ({
      ...h,
      personality: h.personality.includes(tag)
        ? h.personality.filter((t) => t !== tag)
        : [...h.personality, tag],
    }))
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
          // 健康資料
          personality: health.personality,
          boneIssue: health.boneIssue, boneNote: health.boneNote || null,
          skinIssue: health.skinIssue, skinNote: health.skinNote || null,
          earIssue: health.earIssue, earNote: health.earNote || null,
          eyeIssue: health.eyeIssue, eyeNote: health.eyeNote || null,
          heartDisease: health.heartDisease, boneDisease: health.boneDisease,
          skinDisease: health.skinDisease, epilepsy: health.epilepsy, diabetes: health.diabetes,
          surgeryHistory: health.surgeryHistory, surgeryNote: health.surgeryNote || null,
          otherDisease: health.otherDisease || null,
          bathFrequency: health.bathFrequency || null, groomFrequency: health.groomFrequency || null,
          blowDryerFear: health.blowDryerFear || null, afterGroomHandle: health.afterGroomHandle || null,
          consentPhoto: health.consentPhoto, consentSnack: health.consentSnack,
          snackAllergy: health.snackAllergy || null,
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

        {/* Step 1 — Basic info + health */}
        {step === 1 && (
          <>
            <div>
              <h1 className="text-xl font-bold text-gray-900">新客人建檔</h1>
              <p className="text-sm text-gray-500 mt-1">請填寫您與寵物的基本資料</p>
            </div>

            {/* 飼主資料 */}
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

            {/* 寵物基本資料 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-700">寵物基本資料</p>
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
                          form.species === sp ? "border-indigo-500 bg-indigo-600 text-white" : "border-gray-200 text-gray-600 hover:border-indigo-300"
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
                          form.gender === g.value ? "border-indigo-500 bg-indigo-600 text-white" : "border-gray-200 text-gray-600 hover:border-indigo-300"
                        }`}>{g.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 個性標籤 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-700">個性標籤（選填）</p>
              <div className="flex flex-wrap gap-2">
                {PERSONALITY_OPTIONS.map((tag) => (
                  <ToggleChip key={tag} label={tag} active={health.personality.includes(tag)} onClick={() => togglePersonality(tag)} />
                ))}
              </div>
            </div>

            {/* 身體狀況 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-700">身體狀況</p>
              <IssueRow label="骨骼" active={health.boneIssue} note={health.boneNote} onToggle={() => setH("boneIssue", !health.boneIssue)} onNote={(v) => setH("boneNote", v)} />
              <IssueRow label="皮膚" active={health.skinIssue} note={health.skinNote} onToggle={() => setH("skinIssue", !health.skinIssue)} onNote={(v) => setH("skinNote", v)} />
              <IssueRow label="耳朵" active={health.earIssue} note={health.earNote} onToggle={() => setH("earIssue", !health.earIssue)} onNote={(v) => setH("earNote", v)} />
              <IssueRow label="眼睛" active={health.eyeIssue} note={health.eyeNote} onToggle={() => setH("eyeIssue", !health.eyeIssue)} onNote={(v) => setH("eyeNote", v)} />
            </div>

            {/* 病史 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-700">病史（有的請點選）</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "heartDisease" as const, label: "心臟病" },
                  { key: "boneDisease" as const, label: "骨骼疾病" },
                  { key: "skinDisease" as const, label: "皮膚疾病" },
                  { key: "epilepsy" as const, label: "癲癇" },
                  { key: "diabetes" as const, label: "糖尿病" },
                ].map(({ key, label }) => (
                  <ToggleChip key={key} label={label} active={health[key]} onClick={() => setH(key, !health[key])} />
                ))}
                <ToggleChip label="手術史" active={health.surgeryHistory} onClick={() => setH("surgeryHistory", !health.surgeryHistory)} />
              </div>
              {health.surgeryHistory && (
                <Input placeholder="手術說明..." value={health.surgeryNote}
                  onChange={(e) => setH("surgeryNote", e.target.value)} className="h-9 text-sm" />
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">其他病史（選填）</Label>
                <Input placeholder="其他需注意的疾病..." value={health.otherDisease}
                  onChange={(e) => setH("otherDisease", e.target.value)} className="h-9" />
              </div>
            </div>

            {/* 美容習慣 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-700">美容習慣（選填）</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">洗澡頻率</Label>
                  <Input placeholder="例：每月一次" value={health.bathFrequency}
                    onChange={(e) => setH("bathFrequency", e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">美容頻率</Label>
                  <Input placeholder="例：每兩個月" value={health.groomFrequency}
                    onChange={(e) => setH("groomFrequency", e.target.value)} className="h-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">吹風機接受度</Label>
                <div className="flex gap-2 flex-wrap">
                  {BLOW_DRYER_OPTIONS.map((opt) => (
                    <ToggleChip key={opt} label={opt} active={health.blowDryerFear === opt}
                      onClick={() => setH("blowDryerFear", health.blowDryerFear === opt ? "" : opt)} />
                  ))}
                </div>
              </div>
            </div>

            {/* 同意事項 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-700">美容相關同意</p>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">美容後處置方式</Label>
                <div className="flex gap-2 flex-wrap">
                  {AFTER_GROOM_OPTIONS.map((opt) => (
                    <ToggleChip key={opt} label={opt} active={health.afterGroomHandle === opt}
                      onClick={() => setH("afterGroomHandle", health.afterGroomHandle === opt ? "" : opt)} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={health.consentPhoto} onChange={(e) => setH("consentPhoto", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600" />
                  同意拍照作為美容紀錄
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={health.consentSnack} onChange={(e) => setH("consentSnack", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600" />
                  同意美容過程中給予零食獎勵
                </label>
              </div>
              {health.consentSnack && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">零食過敏資訊</Label>
                  <Input placeholder="不能吃的零食種類..." value={health.snackAllergy}
                    onChange={(e) => setH("snackAllergy", e.target.value)} className="h-9" />
                </div>
              )}
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

            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 text-sm">
              <p className="text-indigo-800"><span className="font-medium">飼主：</span>{form.name}（{form.phone}）</p>
              <p className="text-indigo-800 mt-0.5">
                <span className="font-medium">寵物：</span>{form.petName}（{form.breed || form.species}）{form.gender !== "UNKNOWN" ? `・${form.gender === "MALE" ? "公" : "母"}` : ""}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              {contractTemplate ? (
                <div className="prose prose-sm max-w-none text-gray-800"
                  dangerouslySetInnerHTML={{ __html: contractTemplate }} />
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">（店家尚未設定合約範本）</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">手寫簽名</p>
                <button type="button" onClick={clearSig}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                  <RotateCcw className="h-3 w-3" /> 清除
                </button>
              </div>
              <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden">
                <SignatureCanvas ref={sigRef} penColor="black"
                  canvasProps={{ width: 560, height: 180, className: "w-full touch-none", style: { maxWidth: "100%", height: "180px" } }}
                  onBegin={() => setHasSignature(true)} />
              </div>
              <p className="text-xs text-gray-400">請用手指（手機）或滑鼠（電腦）在上方框內簽名</p>
            </div>

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
