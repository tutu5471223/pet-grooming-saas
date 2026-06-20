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
  const [petForm, setPetForm] = useState({
    name: "",
    species: "犬",
    breed: "",
  })

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

      const parsed = parseCustomerText(text)
      setForm({
        name: parsed.name,
        phone: parsed.phone,
        lineId: parsed.lineId,
        address: parsed.address,
        notes: "",
      })

      const pet = parsePetFromText(text)
      if (pet) {
        setPetForm({
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
        })
      }

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
            name: petForm.name.trim(),
            species: petForm.species,
            breed: petForm.breed.trim() || null,
            gender: "UNKNOWN",
            customerId: customer.id,
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
                    辨識完成，已自動填入資料，請確認並補充寵物資料後再儲存。
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
          <form id="new-customer-form" onSubmit={handleSubmit} className="space-y-4">
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
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">同時新增寵物（選填）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="petName">寵物名稱</Label>
              <Input
                id="petName"
                placeholder="小白、咪咪..."
                value={petForm.name}
                onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>物種</Label>
              <Select
                value={petForm.species}
                onValueChange={(v) => setPetForm({ ...petForm, species: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="犬">🐕 犬</SelectItem>
                  <SelectItem value="貓">🐈 貓</SelectItem>
                  <SelectItem value="其他">🐾 其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="petBreed">品種（選填）</Label>
            <Input
              id="petBreed"
              placeholder="馬爾濟斯、柴犬..."
              value={petForm.breed}
              onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <Button
          type="submit"
          form="new-customer-form"
          disabled={loading}
          className="flex-1"
        >
          {loading ? "建立中..." : "建立客人"}
        </Button>
        <Link href="/customers">
          <Button type="button" variant="outline">取消</Button>
        </Link>
      </div>
    </div>
  )
}
