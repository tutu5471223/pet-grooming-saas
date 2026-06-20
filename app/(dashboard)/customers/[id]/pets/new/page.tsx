"use client"

import { useState, useRef } from "react"
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

function parsePetText(raw: string) {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean)
  let name = "", species = "犬", breed = "", chipNumber = "", diseases = "", allergies = ""
  const notesLines: string[] = []

  for (const line of lines) {
    if (/名字|名稱|寵物名/.test(line)) {
      name = line.replace(/.*[:：]\s*/, "").trim()
      continue
    }
    if (/品種/.test(line)) {
      breed = line.replace(/品種\s*[:：]?\s*/, "").trim()
      continue
    }
    // 物種判斷：貓優先，再犬/狗
    if (/貓/.test(line)) { species = "貓"; continue }
    if (/犬|狗/.test(line)) { species = "犬"; continue }
    if (/晶片/.test(line)) {
      const m = line.match(/\d{10,15}/)
      chipNumber = m ? m[0] : line.replace(/晶片\s*號碼?\s*[:：]?\s*/, "").trim()
      continue
    }
    if (/過敏/.test(line)) {
      allergies = line.replace(/過敏\s*[:：]?\s*/, "").trim()
      continue
    }
    if (/疾病|病史|病/.test(line)) {
      diseases = line.replace(/疾病|病史\s*[:：]?\s*/, "").trim()
      continue
    }
    notesLines.push(line)
  }

  return { name, species, breed, chipNumber, diseases, allergies, notes: notesLines.join("\n").trim() }
}

export default function NewPetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: customerId } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    name: "",
    species: "犬",
    breed: "",
    gender: "UNKNOWN",
    birthday: "",
    chipNumber: "",
    diseases: "",
    allergies: "",
    notes: "",
  })

  // Scan state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStatus, setScanStatus] = useState("")
  const [scanError, setScanError] = useState("")
  const [scanDone, setScanDone] = useState(false)

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanError("")
    setScanDone(false)
    setScanProgress(0)
    setScanStatus("")
    const reader = new FileReader()
    reader.onload = (ev) => {
      setScanPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function handleScan() {
    if (!scanPreview) return
    setScanLoading(true)
    setScanError("")
    setScanProgress(20)
    setScanStatus("上傳圖片中...")

    try {
      setScanProgress(40)
      setScanStatus("辨識中...")

      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: scanPreview }),
      })

      setScanProgress(80)
      setScanStatus("解析資料...")

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? "辨識失敗")
      }

      const { text } = await res.json() as { text: string }

      const parsed = parsePetText(text)
      setForm((prev) => ({
        ...prev,
        name: parsed.name || prev.name,
        species: parsed.species,
        breed: parsed.breed || prev.breed,
        chipNumber: parsed.chipNumber || prev.chipNumber,
        diseases: parsed.diseases || prev.diseases,
        allergies: parsed.allergies || prev.allergies,
        notes: parsed.notes || prev.notes,
      }))

      setScanProgress(100)
      setScanDone(true)
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : "辨識失敗，請重試")
    } finally {
      setScanLoading(false)
    }
  }

  function clearScan() {
    setScanPreview(null)
    setScanDone(false)
    setScanError("")
    setScanProgress(0)
    setScanStatus("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, customerId }),
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
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新增寵物</h1>
          <p className="text-sm text-gray-500 mt-0.5">填寫寵物基本資料</p>
        </div>
      </div>

      {/* Scan section */}
      <Card className="border-dashed border-indigo-200 bg-indigo-50/40">
        <CardContent className="pt-4 pb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />

          {!scanPreview ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-100 transition-colors text-sm font-medium"
            >
              <Camera className="h-4 w-4" />
              掃描紙本快速建檔
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <img
                  src={scanPreview}
                  alt="掃描預覽"
                  className="w-full max-h-48 object-contain rounded-lg border border-indigo-200"
                />
                {!scanLoading && (
                  <button
                    type="button"
                    onClick={clearScan}
                    className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {scanLoading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{scanStatus}</span>
                    <span>{scanProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {scanDone && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    辨識完成，已自動填入寵物資料。
                  </div>
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    ⚠️ OCR 辨識準確率有限，請確認並修正辨識結果後再儲存。
                  </p>
                </div>
              )}

              {scanError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{scanError}</p>
              )}

              {!scanDone && !scanLoading && (
                <Button
                  type="button"
                  onClick={handleScan}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  size="sm"
                >
                  開始辨識
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">寵物資料</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">寵物名稱 *</Label>
                <Input
                  id="name"
                  placeholder="小白、咪咪..."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>物種</Label>
                <Select
                  value={form.species}
                  onValueChange={(v) => setForm({ ...form, species: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                <Input
                  id="breed"
                  placeholder="馬爾濟斯、柴犬..."
                  value={form.breed}
                  onChange={(e) => setForm({ ...form, breed: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>性別</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => setForm({ ...form, gender: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                <Input
                  id="birthday"
                  type="date"
                  value={form.birthday}
                  onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chipNumber">晶片號碼</Label>
                <Input
                  id="chipNumber"
                  placeholder="15碼晶片號碼"
                  value={form.chipNumber}
                  onChange={(e) => setForm({ ...form, chipNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="diseases">特殊疾病</Label>
              <Input
                id="diseases"
                placeholder="例：心臟病、氣管塌陷..."
                value={form.diseases}
                onChange={(e) => setForm({ ...form, diseases: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="allergies">過敏紀錄</Label>
              <Input
                id="allergies"
                placeholder="例：對某洗毛精過敏..."
                value={form.allergies}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">備註</Label>
              <Textarea
                id="notes"
                placeholder="其他注意事項"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "建立中..." : "建立寵物"}
              </Button>
              <Link href={`/customers/${customerId}`}>
                <Button type="button" variant="outline">取消</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
