"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Calendar, Repeat, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { addDays, addMonths } from "date-fns"

interface PetResult {
  id: string
  name: string
  species: string
  breed: string | null
  customerId: string
  customer: { name: string; phone: string }
}

interface Staff {
  id: string
  name: string
  role: string
}

const INTERVAL_PRESETS = [7, 10, 14, 21, 28]

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function RecurringAppointmentPage() {
  const router = useRouter()

  const [staffList, setStaffList] = useState<Staff[]>([])

  // Pet search
  const [petSearch, setPetSearch] = useState("")
  const [showPetDropdown, setShowPetDropdown] = useState(false)
  const [petResults, setPetResults] = useState<PetResult[]>([])
  const [selectedPet, setSelectedPet] = useState<PetResult | null>(null)

  const [intervalDays, setIntervalDays] = useState("7")
  // Default start = today 10:00 (lazy init 避免 effect 內同步 setState)
  const [startAt, setStartAt] = useState(() => {
    const now = new Date()
    now.setHours(10, 0, 0, 0)
    return toLocalInput(now)
  })
  const [staffId, setStaffId] = useState("")
  const [notes, setNotes] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/staff", { cache: "no-store" })
      .then((r) => r.json())
      .then((st: Staff[]) => setStaffList(Array.isArray(st) ? st : []))
      .catch(() => {})
  }, [])

  const searchPets = useCallback(async (q: string) => {
    if (!q.trim()) { setPetResults([]); return }
    try {
      const res = await fetch(`/api/pets/all?search=${encodeURIComponent(q)}`)
      setPetResults(await res.json())
    } catch { setPetResults([]) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchPets(petSearch), 200)
    return () => clearTimeout(t)
  }, [petSearch, searchPets])

  function selectPet(pet: PetResult) {
    setSelectedPet(pet)
    setPetSearch(`${pet.name}（${pet.breed ?? pet.species}）- ${pet.customer.name}`)
    setShowPetDropdown(false)
  }

  // 預覽將建立的預約日期（與後端同邏輯）
  const previewDates: Date[] = (() => {
    const interval = Number(intervalDays)
    if (!startAt || !Number.isFinite(interval) || interval < 1) return []
    const start = new Date(startAt)
    if (isNaN(start.getTime())) return []
    const end = addMonths(start, 1)
    const dates: Date[] = []
    for (let d = start; d <= end; d = addDays(d, interval)) {
      dates.push(new Date(d))
      if (dates.length >= 60) break
    }
    return dates
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!selectedPet) { setError("請選擇寵物"); return }
    const interval = Number(intervalDays)
    if (!Number.isFinite(interval) || interval < 1) { setError("請輸入正確的間隔天數"); return }
    if (!startAt) { setError("請選擇開始的預約時間"); return }

    setSubmitting(true)
    try {
      const res = await fetch("/api/appointments/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          petId: selectedPet.id,
          staffId: staffId || null,
          startAt: new Date(startAt).toISOString(),
          intervalDays: interval,
          type: "GROOMING",
          notes: notes || null,
        }),
      })
      if (res.status === 409) {
        // 全部時段都與該美容師既有預約衝突，未建立任何預約。
        const data = await res.json().catch(() => ({}))
        setError(data.error || "所有時段都與該美容師的既有預約衝突，未建立任何預約")
        setSubmitting(false)
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "建立失敗")
      }
      const data = await res.json()
      const skippedCount = Array.isArray(data.skipped) ? data.skipped.length : 0
      // 先提示再跳轉（跳轉後元件卸載，alert 會來不及顯示）。
      alert(
        skippedCount > 0
          ? `已建立 ${data.count} 筆固定週期預約；有 ${skippedCount} 筆因與該美容師時段衝突已跳過。`
          : `已建立 ${data.count} 筆固定週期預約`
      )
      router.push("/appointments")
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "建立固定週期預約失敗，請再試一次")
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/appointments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Repeat className="h-6 w-6 text-indigo-600" />
            固定週期預約
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">依間隔天數，自動建立未來一個月的預約</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pet search */}
        <Card>
          <CardHeader><CardTitle className="text-base">選擇寵物</CardTitle></CardHeader>
          <CardContent>
            <div className="relative">
              <Label htmlFor="petSearch">搜尋寵物名字 *</Label>
              <Input
                id="petSearch"
                placeholder="輸入寵物名稱或主人姓名..."
                value={petSearch}
                onChange={(e) => {
                  setPetSearch(e.target.value)
                  setShowPetDropdown(true)
                  if (!e.target.value) setSelectedPet(null)
                }}
                onFocus={() => setShowPetDropdown(true)}
                onBlur={() => setTimeout(() => setShowPetDropdown(false), 150)}
                autoComplete="off"
                className="mt-1.5"
              />
              {showPetDropdown && petSearch && petResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-52 overflow-y-auto">
                  {petResults.slice(0, 10).map((pet) => (
                    <button
                      key={pet.id}
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 text-left"
                      onClick={() => selectPet(pet)}
                    >
                      <span className="font-medium text-gray-900">
                        {pet.name}
                        <span className="text-gray-400 font-normal ml-1">（{pet.breed ?? pet.species}）</span>
                      </span>
                      <span className="text-gray-500 text-xs shrink-0 ml-2">{pet.customer.name} · {pet.customer.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {showPetDropdown && petSearch && petResults.length === 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  <p className="px-4 py-3 text-sm text-gray-500">找不到寵物</p>
                </div>
              )}
            </div>

            {selectedPet && (
              <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-sm flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">{selectedPet.name}</span>
                  <span className="text-gray-500 ml-1.5">{selectedPet.breed ?? selectedPet.species}</span>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p>{selectedPet.customer.name}</p>
                  <p>{selectedPet.customer.phone}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interval & start time */}
        <Card>
          <CardHeader><CardTitle className="text-base">週期設定</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="intervalDays">間隔天數 *</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id="intervalDays"
                  type="number"
                  min={1}
                  max={90}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                  className="w-28"
                />
                <span className="text-sm text-gray-500">天一次</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {INTERVAL_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setIntervalDays(String(d))}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      Number(intervalDays) === d
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : "border-gray-200 text-gray-600 hover:border-indigo-300"
                    }`}
                  >
                    {d} 天
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="startAt">開始的預約時間 *</Label>
              <div className="relative mt-1.5">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  id="startAt"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">時段由您自選，之後每次預約皆使用相同時刻</p>
            </div>

            <div>
              <Label htmlFor="staff">負責美容師</Label>
              <select
                id="staff"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">不指定</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader><CardTitle className="text-base">預覽（將建立 {previewDates.length} 筆預約）</CardTitle></CardHeader>
          <CardContent>
            {previewDates.length === 0 ? (
              <p className="text-sm text-gray-400">請先設定間隔天數與開始時間</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {previewDates.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <Clock className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    {d.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">備註</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              placeholder="套用於每一筆預約的備註（選填）"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </CardContent>
        </Card>

        {error && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-3 pb-6">
          <Link href="/appointments">
            <Button type="button" variant="outline">取消</Button>
          </Link>
          <Button type="submit" disabled={submitting || previewDates.length === 0}>
            {submitting ? "建立中..." : `建立 ${previewDates.length} 筆預約`}
          </Button>
        </div>
      </form>
    </div>
  )
}
