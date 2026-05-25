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

interface ScannedPet {
  name: string | null
  species: string | null
  breed: string | null
  gender: string | null
  birthday: string | null
  chipNumber: string | null
  specialConditions: string | null
  allergies: string | null
  note: string | null
}

function parseCustomerText(raw: string) {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean)
  let name = "", phone = "", lineId = "", address = ""
  const notesLines: string[] = []

  for (const line of lines) {
    // 電話：10碼數字
    const phoneMatch = line.match(/0\d{9}/)
    if (phoneMatch) {
      if (!phone) phone = phoneMatch[0]
      continue
    }
    // LINE ID
    if (/LINE/i.test(line)) {
      lineId = line.replace(/LINE\s*(ID\s*)?[:：]?\s*/i, "").trim()
      continue
    }
    // 地址
    if (/地址|縣|市|區|路|街|巷|弄|號/.test(line)) {
      address = line.replace(/地址\s*[:：]?\s*/, "").trim()
      continue
    }
    // 姓名關鍵字
    if (/姓名/.test(line)) {
      name = line.replace(/姓名\s*[:：]?\s*/, "").trim()
      continue
    }
    notesLines.push(line)
  }

  // 若還沒找到姓名，取第一個短行（2-6 字、無數字）
  if (!name) {
    const nameLine = lines.find((l) => l.length >= 2 && l.length <= 6 && !/\d/.test(l) && !/LINE/i.test(l))
    if (nameLine) {
      name = nameLine
      const idx = notesLines.indexOf(nameLine)
      if (idx !== -1) notesLines.splice(idx, 1)
    }
  }

  return { name, phone, lineId, address, notes: notesLines.join("\n").trim() }
}

// 從原始文字嘗試解析寵物欄位（回傳一筆，準確率有限）
function parsePetFromText(raw: string): ScannedPet | null {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean)
  let petName: string | null = null
  let species: string | null = null
  let breed: string | null = null
  let chipNumber: string | null = null
  let specialConditions: string | null = null
  let allergies: string | null = null
  const petNotes: string[] = []

  for (const line of lines) {
    if (/名字|名稱|寵物名/.test(line)) {
      petName = line.replace(/.*[:：]\s*/, "").trim() || null
      continue
    }
    if (/品種/.test(line)) {
      breed = line.replace(/品種\s*[:：]?\s*/, "").trim() || null
      continue
    }
    if (/貓/.test(line)) { species = "貓"; continue }
    if (/犬|狗/.test(line)) { species = "犬"; continue }
    if (/晶片/.test(line)) {
      const m = line.match(/\d{10,15}/)
      chipNumber = m ? m[0] : line.replace(/晶片\s*號碼?\s*[:：]?\s*/, "").trim() || null
      continue
    }
    if (/過敏/.test(line)) {
      allergies = line.replace(/過敏\s*[:：]?\s*/, "").trim() || null
      continue
    }
    if (/疾病|病史|病/.test(line)) {
      specialConditions = line.replace(/疾病|病史\s*[:：]?\s*/, "").trim() || null
      continue
    }
    petNotes.push(line)
  }

  if (!petName && !species && !breed) return null
  return {
    name: petName,
    species,
    breed,
    gender: null,
    birthday: null,
    chipNumber,
    specialConditions,
    allergies,
    note: petNotes.join("\n").trim() || null,
  }
}

export default function NewCustomerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    name: "",
    phone: "",
    lineId: "",
    address: "",
    notes: "",
  })

  // Scan state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStatus, setScanStatus] = useState("")
  const [scanError, setScanError] = useState("")
  const [scannedPets, setScannedPets] = useState<ScannedPet[]>([])
  const [scanDone, setScanDone] = useState(false)

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanError("")
    setScanDone(false)
    setScanProgress(0)
    setScanStatus("")
    setScannedPets([])
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
    setScanProgress(5)
    setScanStatus("載入 OCR 引擎...")

    try {
      const { recognize } = await import("tesseract.js")
      const { data: { text } } = await recognize(
        scanPreview,
        "chi_tra+eng",
        {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "loading tesseract core") {
              setScanStatus("載入 OCR 引擎...")
              setScanProgress(10)
            } else if (m.status === "loading language traineddata") {
              setScanStatus("載入語言模型中...")
              setScanProgress(15 + Math.round(m.progress * 35))
            } else if (m.status.startsWith("initializing")) {
              setScanStatus("初始化...")
              setScanProgress(55)
            } else if (m.status === "recognizing text") {
              setScanStatus("辨識中...")
              setScanProgress(60 + Math.round(m.progress * 38))
            }
          },
        }
      )

      const parsed = parseCustomerText(text)
      setForm({
        name: parsed.name,
        phone: parsed.phone,
        lineId: parsed.lineId,
        address: parsed.address,
        notes: parsed.notes,
      })

      const pet = parsePetFromText(text)
      if (pet) setScannedPets([pet])

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
    setScannedPets([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
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
      router.push(`/customers/${customer.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "建立失敗")
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
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
                    <span>
                      辨識完成，已自動填入資料。
                      {scannedPets.length > 0 && (
                        <> 另辨識到 <strong>{scannedPets.length}</strong> 隻寵物，建立客人後可前往新增。</>
                      )}
                    </span>
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
          <CardTitle className="text-base">基本資料</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">姓名 *</Label>
                <Input
                  id="name"
                  placeholder="客人姓名"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">電話 *</Label>
                <Input
                  id="phone"
                  placeholder="09xx-xxx-xxx"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lineId">LINE ID</Label>
              <Input
                id="lineId"
                placeholder="LINE ID（選填）"
                value={form.lineId}
                onChange={(e) => setForm({ ...form, lineId: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">地址</Label>
              <Input
                id="address"
                placeholder="客人地址（選填）"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">備註</Label>
              <Textarea
                id="notes"
                placeholder="其他備註（選填）"
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
                {loading ? "建立中..." : "建立客人"}
              </Button>
              <Link href="/customers">
                <Button type="button" variant="outline">取消</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
