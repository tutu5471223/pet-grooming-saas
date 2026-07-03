"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { use } from "react"
import { ArrowLeft, Camera, X, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DEFAULT_OCR_KEYWORDS, type OcrKeywords } from "@/lib/ocr-keywords"

const PERSONALITY_OPTIONS = ["黏人", "膽小", "親人", "活潑", "易怒", "咬人", "討厭狗狗", "討厭貓咪"]
const BLOW_DRYER_OPTIONS = ["完全接受", "有點怕", "非常怕"]
const AFTER_GROOM_OPTIONS = ["自由落地", "桌上限制活動", "圍片限制活動", "回到自己外出籠", "以上皆可"]

const EMPTY_FORM = {
  name: "", species: "犬", breed: "", gender: "UNKNOWN", birthday: "", chipNumber: "", notes: "",
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
  afterGroomHandle: "", consentPhotoRecord: false, consentPhotoSocial: false, consentSnack: false, snackAllergy: "",
}

const DOG_BREEDS = ["貴賓犬", "貴賓", "瑪爾濟斯", "馬爾他", "黃金獵犬", "黃金", "法國鬥牛", "拉布拉多", "雪納瑞", "薩摩耶", "哈士奇", "米格魯", "吉娃娃", "約克夏", "博美犬", "博美", "柴犬", "西施", "臘腸", "柯基", "米克斯", "混種", "法鬥", "比熊", "瑪爾", "柴"]
const CAT_BREEDS = ["蘇格蘭折耳", "俄羅斯藍", "橘貓", "虎斑", "三花", "玳瑁", "緬因", "布偶", "暹羅", "英短", "美短", "波斯"]
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

function parsePetText(raw: string, kw: OcrKeywords = DEFAULT_OCR_KEYWORDS) {
  const lines = raw.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean)
  const text = lines.join("\n")
  let name = "", species = "犬", breed = "", chipNumber = "", birthday = ""

  const petNameRe = new RegExp("(?:" + kw.petNameKeys.map(escapeRe).join("|") + ")\\s*[:：]")
  const breedRe = new RegExp("(?:" + kw.breedKeys.map(escapeRe).join("|") + ")")
  const breedStripRe = new RegExp(".*(?:" + kw.breedKeys.map(escapeRe).join("|") + ")\\s*[:：]?\\s*")
  const birthdayRe = new RegExp("(?:" + kw.birthdayKeys.map(escapeRe).join("|") + ")")
  const birthdayStripRe = new RegExp(".*(?:" + kw.birthdayKeys.map(escapeRe).join("|") + ")\\s*[:：]?\\s*")

  for (const line of lines) {
    if (petNameRe.test(line)) {
      name = line.replace(/.*[:：]\s*/, "").trim(); break
    }
  }
  for (const line of lines) {
    if (breedRe.test(line)) {
      breed = line.replace(breedStripRe, "").trim(); break
    }
  }
  for (const line of lines) {
    if (/晶片/.test(line)) {
      const m = line.match(/\d{10,15}/)
      chipNumber = m ? m[0] : line.replace(/晶片\s*(?:號碼?)?\s*[:：]?\s*/, "").trim()
      break
    }
  }
  if (!chipNumber) {
    const m = text.match(/\b\d{15}\b/)
    if (m) chipNumber = m[0]
  }
  for (const line of lines) {
    if (birthdayRe.test(line)) {
      const rest = line.replace(birthdayStripRe, "").trim()
      const m = rest.match(/(\d{2,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/)
        ?? rest.match(/(\d{2,4})年(\d{1,2})月(\d{1,2})日?/)
      if (m) {
        let year = parseInt(m[1])
        const month = parseInt(m[2])
        const day = parseInt(m[3])
        if (year < 1912) year += 1911
        birthday = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      }
      break
    }
  }

  if (/貓|喵/.test(text)) species = "貓"
  else if (/兔/.test(text)) species = "兔"
  else if (/鳥|鸚鵡/.test(text)) species = "鳥"
  else species = "犬"

  if (breed) {
    if (CAT_BREEDS.some((b) => breed.includes(b))) species = "貓"
    else if (DOG_BREEDS.some((b) => breed.includes(b))) species = "犬"
  }
  if (!breed) {
    for (const b of CAT_BREEDS) {
      if (text.includes(b)) { breed = b; species = "貓"; break }
    }
    if (!breed) {
      for (const b of DOG_BREEDS) {
        if (text.includes(b)) { breed = b; species = "犬"; break }
      }
    }
  }

  return { name, species, breed, chipNumber, birthday, notes: "" }
}

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

function IssueRow({
  label, active, note,
  onToggle, onNote,
}: { label: string; active: boolean; note: string; onToggle: () => void; onNote: (v: string) => void }) {
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
      const TARGET = 900 * 1024
      for (const q of [0.85, 0.75, 0.65, 0.5, 0.4]) {
        const result = canvas.toDataURL("image/jpeg", q)
        if (result.length <= TARGET) { resolve(result); return }
      }
      canvas.width = Math.round(width / 2)
      canvas.height = Math.round(height / 2)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL("image/jpeg", 0.6))
    }
    img.src = dataUrl
  })
}

export default function NewPetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: customerId } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState(EMPTY_FORM)
  const [ocrKw, setOcrKw] = useState<OcrKeywords>(DEFAULT_OCR_KEYWORDS)
  useEffect(() => {
    fetch("/api/settings/ocr")
      .then((r) => (r.ok ? (r.json() as Promise<OcrKeywords>) : null))
      .then((data) => { if (data) setOcrKw(data) })
      .catch(() => {})
  }, [])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStatus, setScanStatus] = useState("")
  const [scanError, setScanError] = useState("")
  const [scanDone, setScanDone] = useState(false)

  function set<K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function togglePersonality(tag: string) {
    setForm((f) => ({
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
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: scanPreview }),
      })
      setScanProgress(80); setScanStatus("解析資料...")
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? "辨識失敗")
      }
      const { text } = await res.json() as { text: string }
      const parsed = parsePetText(text, ocrKw)
      setForm((prev) => ({
        ...prev,
        name: parsed.name || prev.name,
        species: parsed.species,
        breed: parsed.breed || prev.breed,
        chipNumber: parsed.chipNumber || prev.chipNumber,
        birthday: parsed.birthday || prev.birthday,
        notes: parsed.notes || prev.notes,
      }))
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
      const res = await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customerId,
          breed: form.breed || null,
          birthday: form.birthday || null,
          chipNumber: form.chipNumber || null,
          notes: form.notes || null,
          boneNote: form.boneNote || null,
          skinNote: form.skinNote || null,
          earNote: form.earNote || null,
          eyeNote: form.eyeNote || null,
          surgeryNote: form.surgeryNote || null,
          otherDisease: form.otherDisease || null,
          bathFrequency: form.bathFrequency || null,
          groomFrequency: form.groomFrequency || null,
          blowDryerFear: form.blowDryerFear || null,
          afterGroomHandle: form.afterGroomHandle || null,
          snackAllergy: form.snackAllergy || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "建立失敗")
      }
      const pet = await res.json()
      router.push(`/customers/${customerId}/pets/${pet.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "建立失敗")
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/customers/${customerId}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新增寵物</h1>
          <p className="text-sm text-gray-500 mt-0.5">填寫寵物資料</p>
        </div>
      </div>

      {/* OCR Scan */}
      <Card className="border-dashed border-indigo-200 bg-indigo-50/40">
        <CardContent className="pt-4 pb-4">
          <input
            id="scan-file-pet"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ position: "absolute", width: "1px", height: "1px", opacity: 0, overflow: "hidden" }}
            onChange={handleImageSelect}
          />
          {!scanPreview ? (
            <label
              htmlFor="scan-file-pet"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-100 transition-colors text-sm font-medium cursor-pointer"
            >
              <Camera className="h-4 w-4" /> 掃描紙本快速建檔
            </label>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <img src={scanPreview} alt="掃描預覽" className="w-full max-h-48 object-contain rounded-lg border border-indigo-200" />
                {!scanLoading && (
                  <button type="button" onClick={clearScan} className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-gray-500 hover:text-gray-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {scanLoading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500"><span>{scanStatus}</span><span>{scanProgress}%</span></div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${scanProgress}%` }} />
                  </div>
                </div>
              )}
              {scanDone && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0" /> 辨識完成，已自動填入寵物資料。
                  </div>
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">⚠️ OCR 辨識準確率有限，請確認並修正辨識結果後再儲存。</p>
                </div>
              )}
              {scanError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{scanError}</p>}
              {!scanDone && !scanLoading && (
                <Button type="button" onClick={handleScan} className="w-full bg-indigo-600 hover:bg-indigo-700" size="sm">開始辨識</Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Tabs defaultValue="basic">
          <TabsList className="w-full">
            <TabsTrigger value="basic" className="flex-1">基本資料</TabsTrigger>
            <TabsTrigger value="health" className="flex-1">健康資料</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: 基本資料 ── */}
          <TabsContent value="basic" className="mt-4">
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">寵物名稱 *</Label>
                    <Input id="name" placeholder="小白、咪咪..." value={form.name}
                      onChange={(e) => set("name", e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>物種</Label>
                    <Select value={form.species} onValueChange={(v) => set("species", v)}>
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
                    <Label htmlFor="breed">品種</Label>
                    <Input id="breed" placeholder="馬爾濟斯、柴犬..." value={form.breed}
                      onChange={(e) => set("breed", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>性別</Label>
                    <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">公</SelectItem>
                        <SelectItem value="FEMALE">母</SelectItem>
                        <SelectItem value="UNKNOWN">未知</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="birthday">生日</Label>
                    <Input id="birthday" type="date" value={form.birthday}
                      onChange={(e) => set("birthday", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="chipNumber">晶片號碼</Label>
                    <Input id="chipNumber" placeholder="15碼晶片號碼" value={form.chipNumber}
                      onChange={(e) => set("chipNumber", e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">備註</Label>
                  <Textarea id="notes" placeholder="其他注意事項" value={form.notes}
                    onChange={(e) => set("notes", e.target.value)} rows={3} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 2: 健康資料 ── */}
          <TabsContent value="health" className="mt-4 space-y-4">
            {/* 個性標籤 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">個性標籤</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {PERSONALITY_OPTIONS.map((tag) => (
                  <ToggleChip key={tag} label={tag} active={form.personality.includes(tag)} onClick={() => togglePersonality(tag)} />
                ))}
              </CardContent>
            </Card>

            {/* 身體狀況 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">身體狀況<span className="text-xs font-normal text-gray-400 ml-1">（有問題請點選）</span></CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <IssueRow label="骨骼" active={form.boneIssue} note={form.boneNote} onToggle={() => set("boneIssue", !form.boneIssue)} onNote={(v) => set("boneNote", v)} />
                <IssueRow label="皮膚" active={form.skinIssue} note={form.skinNote} onToggle={() => set("skinIssue", !form.skinIssue)} onNote={(v) => set("skinNote", v)} />
                <IssueRow label="耳朵" active={form.earIssue} note={form.earNote} onToggle={() => set("earIssue", !form.earIssue)} onNote={(v) => set("earNote", v)} />
                <IssueRow label="眼睛" active={form.eyeIssue} note={form.eyeNote} onToggle={() => set("eyeIssue", !form.eyeIssue)} onNote={(v) => set("eyeNote", v)} />
              </CardContent>
            </Card>

            {/* 病史分類 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">病史分類</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "heartDisease" as const, label: "心臟病" },
                    { key: "boneDisease" as const, label: "骨骼疾病" },
                    { key: "skinDisease" as const, label: "皮膚疾病" },
                    { key: "epilepsy" as const, label: "癲癇" },
                    { key: "diabetes" as const, label: "糖尿病" },
                  ].map(({ key, label }) => (
                    <ToggleChip key={key} label={label} active={form[key]} onClick={() => set(key, !form[key])} />
                  ))}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => set("surgeryHistory", !form.surgeryHistory)}
                      className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${
                        form.surgeryHistory ? "border-indigo-500 bg-indigo-600 text-white" : "border-gray-200 text-gray-600 hover:border-indigo-300"
                      }`}>手術史</button>
                  </div>
                  {form.surgeryHistory && (
                    <Input placeholder="手術說明..." value={form.surgeryNote}
                      onChange={(e) => set("surgeryNote", e.target.value)} className="h-8 text-sm" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">其他病史</Label>
                  <Input placeholder="其他需注意的疾病..." value={form.otherDisease}
                    onChange={(e) => set("otherDisease", e.target.value)} />
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
                    <Input placeholder="例：每月一次" value={form.bathFrequency}
                      onChange={(e) => set("bathFrequency", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">美容頻率</Label>
                    <Input placeholder="例：每兩個月" value={form.groomFrequency}
                      onChange={(e) => set("groomFrequency", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">吹風機接受度</Label>
                  <div className="flex gap-2 flex-wrap">
                    {BLOW_DRYER_OPTIONS.map((opt) => (
                      <ToggleChip key={opt} label={opt} active={form.blowDryerFear === opt}
                        onClick={() => set("blowDryerFear", form.blowDryerFear === opt ? "" : opt)} />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 同意事項 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">主人同意事項</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">美容後處置方式</Label>
                  <div className="flex gap-2 flex-wrap">
                    {AFTER_GROOM_OPTIONS.map((opt) => (
                      <ToggleChip key={opt} label={opt} active={form.afterGroomHandle === opt}
                        onClick={() => set("afterGroomHandle", form.afterGroomHandle === opt ? "" : opt)} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.consentPhotoRecord} onChange={(e) => set("consentPhotoRecord", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                    同意拍攝照片作為美容紀錄
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.consentPhotoSocial} onChange={(e) => set("consentPhotoSocial", e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600" />
                    同意寵物在店家拍攝之照片／影片，發布於本店經營之網路社群社交平台
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.consentSnack} onChange={(e) => set("consentSnack", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                    同意美容過程中給予零食獎勵
                  </label>
                </div>
                {form.consentSnack && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">零食過敏資訊</Label>
                    <Input placeholder="不能吃的零食種類..." value={form.snackAllergy}
                      onChange={(e) => set("snackAllergy", e.target.value)} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "建立中..." : "建立寵物"}
          </Button>
          <Link href={`/customers/${customerId}`}>
            <Button type="button" variant="outline">取消</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
