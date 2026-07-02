"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Camera, X, CheckCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PERSONALITY_OPTIONS = ["黏人", "膽小", "親人", "活潑", "易怒", "咬人", "討厭狗狗", "討厭貓咪"]
const BLOW_DRYER_OPTIONS = ["完全接受", "有點怕", "非常怕"]
const AFTER_GROOM_OPTIONS = ["自由落地", "桌上限制活動", "圍片限制活動", "回到自己外出籠", "以上皆可"]

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
        active ? "border-indigo-500 bg-indigo-600 text-white" : "border-gray-200 text-gray-600 hover:border-indigo-300"
      }`}>
      {label}
    </button>
  )
}

function IssueRow({ label, active, note, onToggle, onNote }: {
  label: string; active: boolean; note: string; onToggle: () => void; onNote: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggle}
          className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${
            active ? "border-red-400 bg-red-500 text-white" : "border-gray-200 text-gray-500 hover:border-gray-400"
          }`}>
          {active ? "有問題" : "正常"}
        </button>
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      {active && (
        <Input placeholder="說明..." value={note} onChange={(e) => onNote(e.target.value)} className="h-8 text-sm" />
      )}
    </div>
  )
}

function parseCustomerText(raw: string) {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean)
  let name = "", phone = "", lineId = "", address = ""

  for (const line of lines) {
    const phoneMatch = line.match(/0\d{9}/)
    if (phoneMatch) {
      if (!phone) phone = phoneMatch[0]
      continue
    }
    if (/LINE/i.test(line)) {
      lineId = line.replace(/LINE\s*(ID\s*)?[:：]?\s*/i, "").trim()
      continue
    }
    if (/地址|縣|市|區|路|街|巷|弄|號/.test(line)) {
      address = line.replace(/地址\s*[:：]?\s*/, "").trim()
      continue
    }
    if (/姓名/.test(line)) {
      name = line.replace(/姓名\s*[:：]?\s*/, "").trim()
    }
  }

  if (!name) {
    const nameLine = lines.find((l) => l.length >= 2 && l.length <= 6 && !/\d/.test(l) && !/LINE/i.test(l))
    if (nameLine) name = nameLine
  }

  return { name, phone, lineId, address }
}

function parsePetFromText(raw: string) {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean)
  let name = "", species = "犬", breed = ""
  let foundPet = false

  for (const line of lines) {
    if (/名字|名稱|寵物名/.test(line)) {
      name = line.replace(/.*[:：]\s*/, "").trim()
      foundPet = true
      continue
    }
    if (/品種/.test(line)) {
      breed = line.replace(/品種\s*[:：]?\s*/, "").trim()
      foundPet = true
      continue
    }
    if (/貓/.test(line)) { species = "貓"; foundPet = true; continue }
    if (/犬|狗/.test(line)) { species = "犬"; foundPet = true; continue }
  }

  if (!foundPet) return null
  return { name, species, breed }
}

// Compress image using canvas before upload to avoid 413 errors.
// Scales down to max 1600px and steps quality until base64 string < 900 KB.
function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = () => reject(new Error("圖片載入失敗"))
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const MAX_DIM = 1600
      let { width, height } = img
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) { resolve(dataUrl); return }
      ctx.drawImage(img, 0, 0, width, height)
      // Step down quality until base64 string length < 900 KB (body stays under 1 MB)
      const TARGET = 900 * 1024
      for (const q of [0.85, 0.75, 0.65, 0.5, 0.4]) {
        const result = canvas.toDataURL("image/jpeg", q)
        if (result.length <= TARGET) { resolve(result); return }
      }
      // Last resort: halve dimensions
      canvas.width = Math.round(width / 2)
      canvas.height = Math.round(height / 2)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL("image/jpeg", 0.6))
    }
    img.src = dataUrl
  })
}

const EMPTY_PET = {
  name: "", species: "犬", breed: "", gender: "UNKNOWN", birthday: "",
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
  afterGroomHandle: "", consentPhotoRecord: false, consentPhotoSocial: false,
  consentSnack: false, snackAllergy: "",
}

type PetForm = typeof EMPTY_PET

export default function NewCustomerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    name: "", phone: "", lineId: "", idNumber: "", address: "", notes: "",
  })
  const [petForm, setPetForm] = useState<PetForm>(EMPTY_PET)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStatus, setScanStatus] = useState("")
  const [scanError, setScanError] = useState("")
  const [scanDone, setScanDone] = useState(false)

  function setPet<K extends keyof PetForm>(k: K, v: PetForm[K]) {
    setPetForm((f) => ({ ...f, [k]: v }))
  }

  function togglePersonality(tag: string) {
    setPetForm((f) => ({
      ...f,
      personality: f.personality.includes(tag)
        ? f.personality.filter((t) => t !== tag)
        : [...f.personality, tag],
    }))
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanError(""); setScanDone(false); setScanProgress(0); setScanStatus("壓縮圖片中...")
    const reader = new FileReader()
    reader.onerror = () => setScanError("讀取圖片失敗")
    reader.onload = (ev) => {
      const raw = ev.target?.result as string
      compressImage(raw)
        .then((compressed) => { setScanPreview(compressed); setScanStatus("") })
        .catch(() => setScanError("圖片壓縮失敗，請重試"))
    }
    reader.readAsDataURL(file)
  }

  async function handleScan() {
    if (!scanPreview) return
    setScanLoading(true); setScanError(""); setScanProgress(20); setScanStatus("上傳圖片中...")
    try {
      setScanProgress(40); setScanStatus("辨識中...")
      let res: Response
      try {
        res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: scanPreview }),
        })
      } catch (fetchErr: unknown) {
        throw new Error(fetchErr instanceof Error ? `網路錯誤：${fetchErr.message}` : "網路連線失敗，請確認網路後重試")
      }
      setScanProgress(80); setScanStatus("解析資料...")
      if (!res.ok) {
        let errMsg = "辨識失敗"
        try {
          const data = await res.json() as { error?: string }
          errMsg = data.error ?? errMsg
        } catch { /* ignore */ }
        throw new Error(errMsg)
      }
      const { text } = await res.json() as { text: string }
      const parsed = parseCustomerText(text)
      setForm({ name: parsed.name, phone: parsed.phone, lineId: parsed.lineId, idNumber: "", address: parsed.address, notes: "" })
      const pet = parsePetFromText(text)
      if (pet) setPetForm((f) => ({ ...f, name: pet.name, species: pet.species, breed: pet.breed }))
      setScanProgress(100); setScanDone(true)
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : "辨識失敗，請重試")
    } finally {
      setScanLoading(false)
    }
  }

  function clearScan() {
    setScanPreview(null); setScanDone(false); setScanError(""); setScanProgress(0); setScanStatus("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "建立失敗")
      }
      const customer = await res.json()

      if (petForm.name.trim()) {
        await fetch("/api/pets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: customer.id,
            name: petForm.name.trim(),
            species: petForm.species,
            breed: petForm.breed.trim() || null,
            gender: petForm.gender,
            birthday: petForm.birthday || null,
            personality: petForm.personality,
            boneIssue: petForm.boneIssue, boneNote: petForm.boneNote || null,
            skinIssue: petForm.skinIssue, skinNote: petForm.skinNote || null,
            earIssue: petForm.earIssue, earNote: petForm.earNote || null,
            eyeIssue: petForm.eyeIssue, eyeNote: petForm.eyeNote || null,
            heartDisease: petForm.heartDisease, boneDisease: petForm.boneDisease,
            skinDisease: petForm.skinDisease, epilepsy: petForm.epilepsy, diabetes: petForm.diabetes,
            surgeryHistory: petForm.surgeryHistory, surgeryNote: petForm.surgeryNote || null,
            otherDisease: petForm.otherDisease || null,
            bathFrequency: petForm.bathFrequency || null,
            groomFrequency: petForm.groomFrequency || null,
            blowDryerFear: petForm.blowDryerFear || null,
            afterGroomHandle: petForm.afterGroomHandle || null,
            consentPhotoRecord: petForm.consentPhotoRecord,
            consentPhotoSocial: petForm.consentPhotoSocial,
            consentSnack: petForm.consentSnack,
            snackAllergy: petForm.snackAllergy || null,
          }),
        })
      }

      router.push(`/customers/${customer.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "建立失敗")
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/customers">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新增客人</h1>
          <p className="text-sm text-gray-500 mt-0.5">填寫客人基本資料</p>
        </div>
      </div>

      {/* Scan section */}
      <Card className="border-dashed border-indigo-200 bg-indigo-50/40">
        <CardContent className="pt-4 pb-4">
          <input
            id="scan-file-customer"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ position: "absolute", width: "1px", height: "1px", opacity: 0, overflow: "hidden" }}
            onChange={handleImageSelect}
          />
          {!scanPreview ? (
            <label
              htmlFor="scan-file-customer"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-100 transition-colors text-sm font-medium cursor-pointer"
            >
              <Camera className="h-4 w-4" />掃描紙本快速建檔
            </label>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <img src={scanPreview} alt="掃描預覽" className="w-full max-h-48 object-contain rounded-lg border border-indigo-200" />
                {!scanLoading && (
                  <button type="button" onClick={clearScan}
                    className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-gray-500 hover:text-gray-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {scanLoading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{scanStatus}</span><span>{scanProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${scanProgress}%` }} />
                  </div>
                </div>
              )}
              {scanDone && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    辨識完成，已自動填入資料，請確認並補充寵物資料後再儲存。
                  </div>
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    ⚠️ OCR 辨識準確率有限，請確認並修正辨識結果後再儲存。
                  </p>
                </div>
              )}
              {scanError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{scanError}</p>}
              {!scanDone && !scanLoading && (
                <Button type="button" onClick={handleScan} className="w-full bg-indigo-600 hover:bg-indigo-700" size="sm">
                  開始辨識
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer form */}
      <Card>
        <CardHeader><CardTitle className="text-base">基本資料</CardTitle></CardHeader>
        <CardContent>
          <form id="new-customer-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">姓名 *</Label>
                <Input id="name" placeholder="客人姓名" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">電話 *</Label>
                <Input id="phone" placeholder="09xx-xxx-xxx" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lineId">LINE ID</Label>
              <Input id="lineId" placeholder="LINE ID（選填）" value={form.lineId}
                onChange={(e) => setForm({ ...form, lineId: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="idNumber">身分證字號</Label>
                <Input id="idNumber" placeholder="A123456789（選填）" value={form.idNumber}
                  onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">地址</Label>
                <Input id="address" placeholder="客人地址（選填）" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">備註</Label>
              <Textarea id="notes" placeholder="其他備註（選填）" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Pet section */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">同時新增寵物（選填）</h2>

        {/* 基本資料 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">寵物基本資料</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="petName">寵物名稱</Label>
                <Input id="petName" placeholder="小白、咪咪..." value={petForm.name}
                  onChange={(e) => setPet("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>物種</Label>
                <Select value={petForm.species} onValueChange={(v) => setPet("species", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="犬">🐕 犬</SelectItem>
                    <SelectItem value="貓">🐈 貓</SelectItem>
                    <SelectItem value="兔">🐇 兔</SelectItem>
                    <SelectItem value="鳥">🦜 鳥</SelectItem>
                    <SelectItem value="其他">🐾 其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="petBreed">品種</Label>
                <Input id="petBreed" placeholder="馬爾濟斯、柴犬...（選填）" value={petForm.breed}
                  onChange={(e) => setPet("breed", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>性別</Label>
                <Select value={petForm.gender} onValueChange={(v) => setPet("gender", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">公</SelectItem>
                    <SelectItem value="FEMALE">母</SelectItem>
                    <SelectItem value="UNKNOWN">未知</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="petBirthday">生日</Label>
              <Input id="petBirthday" type="date" value={petForm.birthday}
                onChange={(e) => setPet("birthday", e.target.value)} className="w-48" />
            </div>
          </CardContent>
        </Card>

        {/* 健康資料（只在有填寵物名稱時展開） */}
        {petForm.name.trim() && (
          <>
            {/* 個性標籤 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">個性標籤</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {PERSONALITY_OPTIONS.map((tag) => (
                  <ToggleChip key={tag} label={tag} active={petForm.personality.includes(tag)} onClick={() => togglePersonality(tag)} />
                ))}
              </CardContent>
            </Card>

            {/* 身體狀況 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  身體狀況<span className="text-xs font-normal text-gray-400 ml-1">（有問題請點選）</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <IssueRow label="骨骼問題" active={petForm.boneIssue} note={petForm.boneNote}
                  onToggle={() => setPet("boneIssue", !petForm.boneIssue)} onNote={(v) => setPet("boneNote", v)} />
                <IssueRow label="皮膚問題" active={petForm.skinIssue} note={petForm.skinNote}
                  onToggle={() => setPet("skinIssue", !petForm.skinIssue)} onNote={(v) => setPet("skinNote", v)} />
                <IssueRow label="耳朵問題" active={petForm.earIssue} note={petForm.earNote}
                  onToggle={() => setPet("earIssue", !petForm.earIssue)} onNote={(v) => setPet("earNote", v)} />
                <IssueRow label="眼睛問題" active={petForm.eyeIssue} note={petForm.eyeNote}
                  onToggle={() => setPet("eyeIssue", !petForm.eyeIssue)} onNote={(v) => setPet("eyeNote", v)} />
              </CardContent>
            </Card>

            {/* 病史 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">病史</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "heartDisease" as const, label: "心臟病" },
                    { key: "boneDisease" as const, label: "骨骼疾病" },
                    { key: "skinDisease" as const, label: "皮膚疾病" },
                    { key: "epilepsy" as const, label: "癲癇" },
                    { key: "diabetes" as const, label: "糖尿病" },
                  ]).map(({ key, label }) => (
                    <ToggleChip key={key} label={label} active={petForm[key]} onClick={() => setPet(key, !petForm[key])} />
                  ))}
                </div>
                <div className="space-y-1.5">
                  <button type="button" onClick={() => setPet("surgeryHistory", !petForm.surgeryHistory)}
                    className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${
                      petForm.surgeryHistory ? "border-indigo-500 bg-indigo-600 text-white" : "border-gray-200 text-gray-600 hover:border-indigo-300"
                    }`}>手術史</button>
                  {petForm.surgeryHistory && (
                    <Input placeholder="手術說明..." value={petForm.surgeryNote}
                      onChange={(e) => setPet("surgeryNote", e.target.value)} className="h-8 text-sm" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">其他病史說明</Label>
                  <Input placeholder="其他需注意的疾病..." value={petForm.otherDisease}
                    onChange={(e) => setPet("otherDisease", e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* 美容習慣 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">美容習慣</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">洗澡頻率</Label>
                    <Input placeholder="例：每月一次" value={petForm.bathFrequency}
                      onChange={(e) => setPet("bathFrequency", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">剪毛頻率</Label>
                    <Input placeholder="例：每兩個月" value={petForm.groomFrequency}
                      onChange={(e) => setPet("groomFrequency", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">吹風機接受度</Label>
                  <div className="flex gap-2 flex-wrap">
                    {BLOW_DRYER_OPTIONS.map((opt) => (
                      <ToggleChip key={opt} label={opt} active={petForm.blowDryerFear === opt}
                        onClick={() => setPet("blowDryerFear", petForm.blowDryerFear === opt ? "" : opt)} />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 主人同意事項 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">主人同意事項</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">美容後處置方式</Label>
                  <div className="flex gap-2 flex-wrap">
                    {AFTER_GROOM_OPTIONS.map((opt) => (
                      <ToggleChip key={opt} label={opt} active={petForm.afterGroomHandle === opt}
                        onClick={() => setPet("afterGroomHandle", petForm.afterGroomHandle === opt ? "" : opt)} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={petForm.consentPhotoRecord}
                      onChange={(e) => setPet("consentPhotoRecord", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                    同意拍攝照片作為美容紀錄
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={petForm.consentPhotoSocial}
                      onChange={(e) => setPet("consentPhotoSocial", e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600" />
                    同意寵物在店家拍攝之照片／影片，發布於本店經營之網路社群社交平台
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={petForm.consentSnack}
                      onChange={(e) => setPet("consentSnack", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                    同意美容過程中給予零食獎勵
                  </label>
                </div>
                {petForm.consentSnack && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">零食過敏資訊</Label>
                    <Input placeholder="不能吃的零食種類..." value={petForm.snackAllergy}
                      onChange={(e) => setPet("snackAllergy", e.target.value)} />
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" form="new-customer-form" disabled={loading} className="flex-1">
          {loading ? "建立中..." : "建立客人"}
        </Button>
        <Link href="/customers">
          <Button type="button" variant="outline">取消</Button>
        </Link>
      </div>
    </div>
  )
}
