"use client"

import { useEffect, useRef, useState } from "react"
import { Scissors, CheckCircle2, ChevronRight, ChevronLeft, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/utils"

interface Service {
  id: string
  name: string
  price: number
  duration: number | null
  category: string | null
}

interface Shop {
  id: string
  name: string
  phone: string | null
  address: string | null
}

const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const hour = String(Math.floor(i / 2) + 8).padStart(2, "0")
  const min = i % 2 === 0 ? "00" : "30"
  return `${hour}:${min}`
})

interface BookingClientProps {
  shop: Shop
  services: Service[]
  shopId: string
}

interface FoundPet {
  id: string
  name: string
  species: string
}

export function BookingClient({ shop, services, shopId }: BookingClientProps) {
  const [step, setStep] = useState(1)

  // Step 1 state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Step 2 state
  const [form, setForm] = useState({
    name: "",
    phone: "",
    petName: "",
    petSpecies: "犬",
    preferredDate: "",
    preferredTime: "",
    preferredTime2: "",
    preferredTime3: "",
    notes: "",
  })
  const [phoneError, setPhoneError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Step 3 state
  const [appointmentId, setAppointmentId] = useState("")

  // Pet-specific pricing
  const [petPriceMap, setPetPriceMap] = useState<Record<string, number>>({})

  // Phone lookup state (Task 3)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult] = useState<{ customerName: string; pets: FoundPet[] } | null>(null)
  const [lookupNotFound, setLookupNotFound] = useState(false)

  const today = new Date().toISOString().split("T")[0]
  const selectedServices = services.filter((s) => selectedIds.has(s.id))

  // Apply pet-specific pricing
  const effectiveServices = selectedServices.map((s) => ({
    ...s,
    effectivePrice: petPriceMap[s.id] !== undefined ? petPriceMap[s.id] : s.price,
    isCustomPrice: petPriceMap[s.id] !== undefined,
  }))
  const totalCost = effectiveServices.reduce((sum, s) => sum + s.effectivePrice, 0)
  const hasPetPricing = effectiveServices.some((s) => s.isCustomPrice)

  // Debounced pet pricing lookup
  const pricingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (pricingTimerRef.current) clearTimeout(pricingTimerRef.current)
    const { phone, petName } = form
    if (!phone || !petName || selectedIds.size === 0) { setPetPriceMap({}); return }
    if (!/^09\d{8}$/.test(phone)) return
    pricingTimerRef.current = setTimeout(() => {
      const serviceIds = Array.from(selectedIds).join(",")
      fetch(`/api/booking/${shopId}/pet-pricing?phone=${encodeURIComponent(phone)}&petName=${encodeURIComponent(petName)}&serviceIds=${serviceIds}`)
        .then((r) => r.json())
        .then((data: { serviceId: string; price: number }[]) => {
          const map: Record<string, number> = {}
          data.forEach(({ serviceId, price }) => { map[serviceId] = price })
          setPetPriceMap(map)
        })
        .catch(() => {})
    }, 400)
    return () => { if (pricingTimerRef.current) clearTimeout(pricingTimerRef.current) }
  }, [form.phone, form.petName, selectedIds, shopId])

  function toggleService(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function validatePhone(phone: string) {
    if (!phone) return "請輸入手機號碼"
    if (!/^09\d{8}$/.test(phone)) return "手機號碼格式錯誤（09xxxxxxxx）"
    return ""
  }

  async function lookupPhone() {
    const err = validatePhone(form.phone)
    if (err) { setPhoneError(err); return }
    setLookupLoading(true)
    setLookupResult(null)
    setLookupNotFound(false)
    try {
      const res = await fetch(`/api/booking/${shopId}/lookup?phone=${encodeURIComponent(form.phone)}`)
      const data = await res.json()
      if (data.found) {
        setLookupResult(data)
        // Pre-fill name; if only 1 pet, pre-fill pet too
        if (data.pets?.length === 1) {
          setForm((f) => ({ ...f, name: data.customerName, petName: data.pets[0].name, petSpecies: data.pets[0].species }))
        } else {
          setForm((f) => ({ ...f, name: data.customerName }))
        }
      } else {
        setLookupNotFound(true)
      }
    } catch {
      // ignore
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleSubmit() {
    const phoneErr = validatePhone(form.phone)
    if (phoneErr) { setPhoneError(phoneErr); return }
    const actualPetName = form.petName.trim()
    if (!form.name.trim() || !actualPetName) {
      setSubmitError("請填寫姓名與寵物名稱")
      return
    }
    setSubmitting(true)
    setSubmitError("")
    try {
      const res = await fetch(`/api/booking/${shopId}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone,
          petName: actualPetName,
          petSpecies: form.petSpecies,
          preferredDate: form.preferredDate || null,
          preferredTime: form.preferredTime || null,
          preferredTime2: form.preferredTime2 || null,
          preferredTime3: form.preferredTime3 || null,
          notes: form.notes,
          services: effectiveServices.map((s) => ({ name: s.name, price: s.effectivePrice })),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "送出失敗")
      }
      const { appointmentId: id } = await res.json()
      setAppointmentId(id)
      setStep(3)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "送出失敗")
    } finally {
      setSubmitting(false)
    }
  }

  const grouped = services.reduce<Record<string, Service[]>>((acc, svc) => {
    const cat = svc.category ?? "其他"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(svc)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-4 sticky top-0 z-10">
        <div className="mx-auto max-w-lg flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shrink-0">
            <Scissors className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{shop.name}</p>
            <p className="text-xs text-gray-500">線上預約申請</p>
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

      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">

        {/* Step 1: Service selection */}
        {step === 1 && (
          <>
            <h2 className="text-base font-semibold text-gray-900">選擇服務項目</h2>
            <p className="text-sm text-gray-500">可複選，價格僅供參考，店家確認時可調整</p>

            {services.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">此店家尚未設定服務項目</div>
            ) : (
              Object.entries(grouped).map(([cat, svcs]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{cat}</p>
                  <div className="space-y-2">
                    {svcs.map((svc) => {
                      const selected = selectedIds.has(svc.id)
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => toggleService(svc.id)}
                          className={`w-full flex items-center justify-between rounded-xl border p-4 text-left transition-colors ${
                            selected ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white hover:border-indigo-300"
                          }`}
                        >
                          <div>
                            <span className="font-medium text-gray-900">{svc.name}</span>
                            {svc.duration && <span className="ml-2 text-xs text-gray-400">{svc.duration} 分鐘</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-indigo-600">{formatCurrency(svc.price)}</span>
                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selected ? "border-indigo-600 bg-indigo-600" : "border-gray-300"}`}>
                              {selected && <div className="h-2 w-2 rounded-full bg-white" />}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}

            {selectedIds.size > 0 && (
              <div className="sticky bottom-4 rounded-2xl bg-indigo-600 p-4 text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm">已選 {selectedIds.size} 項服務</span>
                  <span className="font-bold text-lg">{formatCurrency(totalCost)}</span>
                </div>
                <Button className="w-full bg-white text-indigo-600 hover:bg-indigo-50" onClick={() => setStep(2)}>
                  下一步：填寫資料
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {selectedIds.size === 0 && services.length > 0 && (
              <Button variant="outline" className="w-full" onClick={() => setStep(2)}>
                跳過，直接填寫資料
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </>
        )}

        {/* Step 2: Customer info */}
        {step === 2 && (
          <>
            <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ChevronLeft className="h-4 w-4" />
              返回選擇服務
            </button>
            <h2 className="text-base font-semibold text-gray-900">填寫預約資料</h2>

            {/* Selected services summary — Task 1: font size increased */}
            {effectiveServices.length > 0 && (
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                <p className="text-xs font-medium text-indigo-700 mb-1">已選服務</p>
                <div className="flex flex-wrap gap-1.5">
                  {effectiveServices.map((s) => (
                    <span key={s.id} className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm text-indigo-700">
                      {s.name}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-indigo-600 font-semibold mt-2">
                  預估費用：{formatCurrency(totalCost)}
                  {hasPetPricing && <span className="ml-1.5 text-amber-600 font-normal">（已套用專屬定價）</span>}
                </p>
                <p className="text-sm text-gray-500 mt-1">實際費用依寵物狀況可能略有調整，由店家確認後告知</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Contact info — Task 3: phone lookup */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">聯絡資料</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs">手機號碼 *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="0912345678"
                        value={form.phone}
                        onChange={(e) => {
                          setForm({ ...form, phone: e.target.value })
                          setPhoneError("")
                          setLookupResult(null)
                          setLookupNotFound(false)
                        }}
                        className={`h-9 text-sm flex-1 ${phoneError ? "border-red-400" : ""}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={lookupPhone}
                        disabled={lookupLoading}
                        className="shrink-0 h-9 gap-1.5"
                      >
                        <Search className="h-3.5 w-3.5" />
                        {lookupLoading ? "查詢中" : "查詢"}
                      </Button>
                    </div>
                    {phoneError && <p className="text-xs text-red-500">{phoneError}</p>}
                    {lookupNotFound && <p className="text-xs text-gray-500">查無此電話的客人資料，請自行填寫</p>}
                    {lookupResult && <p className="text-xs text-green-600">✓ 找到客人：{lookupResult.customerName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs">姓名 *</Label>
                    <Input
                      id="name"
                      placeholder="王小明"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Pet info — Task 3: pet dropdown from lookup */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">寵物資料</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">寵物名稱 *</Label>
                    {lookupResult && lookupResult.pets.length > 1 ? (
                      <select
                        value={form.petName}
                        onChange={(e) => {
                          const pet = lookupResult.pets.find((p) => p.name === e.target.value)
                          setForm({ ...form, petName: e.target.value, petSpecies: pet?.species ?? "犬" })
                        }}
                        className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">請選擇寵物</option>
                        {lookupResult.pets.map((p) => (
                          <option key={p.id} value={p.name}>{p.name}（{p.species}）</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id="petName"
                        placeholder="小白"
                        value={form.petName}
                        onChange={(e) => setForm({ ...form, petName: e.target.value })}
                        className="h-9 text-sm"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">寵物種類</Label>
                    <div className="flex gap-1.5">
                      {["犬", "貓", "其他"].map((sp) => (
                        <button
                          key={sp}
                          type="button"
                          onClick={() => setForm({ ...form, petSpecies: sp })}
                          className={`flex-1 rounded-lg border py-1.5 text-sm transition-colors ${
                            form.petSpecies === sp
                              ? "border-indigo-500 bg-indigo-600 text-white"
                              : "border-gray-200 text-gray-600 hover:border-indigo-300"
                          }`}
                        >
                          {sp}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preference */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">偏好時間</p>
                  <p className="text-xs text-gray-400 mt-0.5">僅供參考，店家將與您確認實際時間，非即時預約</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="preferredDate" className="text-xs">偏好日期</Label>
                    <Input
                      id="preferredDate"
                      type="date"
                      min={today}
                      value={form.preferredDate}
                      onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="preferredTime" className="text-xs">第一選擇時間 *</Label>
                    <select
                      id="preferredTime"
                      value={form.preferredTime}
                      onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
                      className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">不指定</option>
                      {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="preferredTime2" className="text-xs">第二選擇時間（選填）</Label>
                    <select
                      id="preferredTime2"
                      value={form.preferredTime2}
                      onChange={(e) => setForm({ ...form, preferredTime2: e.target.value })}
                      className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">不指定</option>
                      {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="preferredTime3" className="text-xs">第三選擇時間（選填）</Label>
                    <select
                      id="preferredTime3"
                      value={form.preferredTime3}
                      onChange={(e) => setForm({ ...form, preferredTime3: e.target.value })}
                      className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">不指定</option>
                      {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs">備註</Label>
                  <Textarea
                    id="notes"
                    placeholder="特殊需求、寵物狀況或其他說明..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    className="text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            {submitError && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{submitError}</p>
            )}

            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "送出中..." : "送出預約申請"}
            </Button>
            <p className="text-xs text-center text-gray-400">
              送出後店家將審核並聯絡您確認時間，非即時預約
            </p>
          </>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="text-center py-8 space-y-6">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900">預約申請已送出！</h2>
              <p className="text-gray-500 mt-2">感謝您的預約，我們將盡快與您確認時間</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 text-left space-y-3">
              <p className="text-sm font-semibold text-gray-700">預約摘要</p>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>姓名</span>
                  <span className="font-medium text-gray-900">{form.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>寵物</span>
                  <span className="font-medium text-gray-900">{form.petName} ({form.petSpecies})</span>
                </div>
                {effectiveServices.length > 0 && (
                  <div className="flex justify-between">
                    <span>服務項目</span>
                    <span className="font-medium text-gray-900 text-right max-w-[60%]">
                      {effectiveServices.map((s) => s.name).join("、")}
                    </span>
                  </div>
                )}
                {totalCost > 0 && (
                  <div className="flex justify-between">
                    <span>預估費用</span>
                    <span className="font-medium text-indigo-600">{formatCurrency(totalCost)}</span>
                  </div>
                )}
                {form.preferredDate && (
                  <>
                    <div className="flex justify-between">
                      <span>第一選擇</span>
                      <span className="font-medium text-gray-900">
                        {form.preferredDate}{form.preferredTime ? ` ${form.preferredTime}` : ""}
                      </span>
                    </div>
                    {form.preferredTime2 && (
                      <div className="flex justify-between">
                        <span>第二選擇</span>
                        <span className="font-medium text-gray-900">{form.preferredDate} {form.preferredTime2}</span>
                      </div>
                    )}
                    {form.preferredTime3 && (
                      <div className="flex justify-between">
                        <span>第三選擇</span>
                        <span className="font-medium text-gray-900">{form.preferredDate} {form.preferredTime3}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 text-left">
              店家將於確認後主動聯絡您。如需立即聯絡，請致電{" "}
              {shop.phone ? (
                <a href={`tel:${shop.phone}`} className="font-semibold underline">{shop.phone}</a>
              ) : "店家"}。
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
