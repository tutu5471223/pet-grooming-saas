"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, X, Clock, Calendar, Home, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { differenceInDays } from "date-fns"

interface PetResult {
  id: string
  name: string
  species: string
  breed: string | null
  customerId: string
  customer: { name: string; phone: string }
  contract: { status: string; signedAt: string | null } | null
}

interface Service {
  id: string
  name: string
  category: string | null
  price: number
  duration: number | null
}

interface Staff {
  id: string
  name: string
  role: string
}

interface Room {
  id: string
  name: string
  type: string | null
  dailyRate: number
  status: string
}

interface SelectedService {
  id: string
  name: string
  price: number
  defaultPrice: number
  duration: number | null
  isCustomPrice: boolean
  category: string | null
}

interface ActivePlan {
  id: string
  name: string
  maxSessions: number
  usedSessions: number
  startDate: string
  endDate: string
}

interface PlanTemplate {
  id: string
  name: string
  price: number
  sessions: number
  validDays: number
  description: string | null
}

const APPOINTMENT_TYPES = [
  { value: "GROOMING", label: "美容" },
  { value: "BOARDING", label: "住宿" },
  { value: "CONSULTATION", label: "諮詢" },
]

const SOURCES = [
  { value: "WALK_IN", label: "現場" },
  { value: "PHONE", label: "電話" },
  { value: "LINE", label: "LINE" },
  { value: "WEB", label: "網路" },
]

export default function NewAppointmentPage() {
  const router = useRouter()

  const [services, setServices] = useState<Service[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [petPriceMap, setPetPriceMap] = useState<Record<string, number>>({})

  // Monthly plan state
  const [activePlans, setActivePlans] = useState<ActivePlan[]>([])
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([])
  const [paymentMethod, setPaymentMethod] = useState<"SINGLE" | "MONTHLY_PLAN" | "BUY_AND_USE">("SINGLE")
  const [selectedPlanId, setSelectedPlanId] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")

  // Pet search
  const [petSearch, setPetSearch] = useState("")
  const [showPetDropdown, setShowPetDropdown] = useState(false)
  const [petResults, setPetResults] = useState<PetResult[]>([])
  const [selectedPet, setSelectedPet] = useState<PetResult | null>(null)
  const [selectedPetId, setSelectedPetId] = useState("")

  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([])

  const [form, setForm] = useState({
    type: "GROOMING",
    scheduledAt: "",
    staffId: "",
    source: "WALK_IN",
    notes: "",
    duration: "",
    estimatedCost: "",
    boardingCheckOut: "",
    boardingRoomId: "",
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [conflict, setConflict] = useState<{ petName: string; scheduledAt: string; duration: number | null } | null>(null)

  // Dedicated staff fetcher — called on mount and on window focus
  const fetchStaff = useCallback(() => {
    fetch("/api/staff", { cache: "no-store" })
      .then((r) => r.json())
      .then((st: Staff[]) => setStaffList(st))
      .catch(() => {})
  }, [])

  // Load base data
  useEffect(() => {
    fetch("/api/monthly-plans").then(r => r.json()).then((data: PlanTemplate[]) => {
      setPlanTemplates(Array.isArray(data) ? data.filter(p => (p as { isActive?: boolean }).isActive !== false) : [])
    }).catch(() => {})

    Promise.all([
      fetch("/api/services", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/staff", { cache: "no-store" }).then((r) => r.json()),
    ]).then(([s, st]: [Service[], Staff[]]) => {
      setServices(s)
      setStaffList(st)

      // Check URL param first (from pet book button), then localStorage
      const urlPetId = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("petId")
        : null
      const lsPetId = (() => {
        try {
          const saved = localStorage.getItem("lastAppointmentSelection")
          return saved ? (JSON.parse(saved) as { petId: string }).petId : null
        } catch { return null }
      })()
      const targetPetId = urlPetId || lsPetId
      if (targetPetId) {
        fetch(`/api/pets/all?search=`)
          .then((r) => r.json())
          .then((pets: PetResult[]) => {
            const pet = pets.find((p) => p.id === targetPetId)
            if (pet) restorePet(pet)
          })
          .catch(() => {})
      }
    })

    // Re-fetch staff when window gains focus (user added staff in another tab)
    window.addEventListener("focus", fetchStaff)
    return () => window.removeEventListener("focus", fetchStaff)
  }, [fetchStaff])

  // Load rooms when switching to BOARDING
  useEffect(() => {
    if (form.type === "BOARDING" && rooms.length === 0) {
      fetch("/api/boarding/rooms").then((r) => r.json()).then(setRooms).catch(() => {})
    }
  }, [form.type, rooms.length])

  // Fetch active monthly plans when pet changes
  useEffect(() => {
    if (!selectedPetId) { setActivePlans([]); setPaymentMethod("SINGLE"); setSelectedPlanId(""); return }
    const now = new Date()
    fetch(`/api/pets/${selectedPetId}/monthly-plans`)
      .then(r => r.json())
      .then((plans: ActivePlan[]) => {
        const active = plans.filter(p =>
          new Date(p.endDate) >= now &&
          new Date(p.startDate) <= now &&
          p.usedSessions < p.maxSessions
        )
        setActivePlans(active)
        if (active.length === 0) { setPaymentMethod("SINGLE"); setSelectedPlanId("") }
        else if (active.length === 1) setSelectedPlanId(active[0].id)
      })
      .catch(() => setActivePlans([]))
  }, [selectedPetId])

  // Fetch pet-specific pricing when pet changes
  useEffect(() => {
    if (!selectedPetId) { setPetPriceMap({}); return }
    fetch(`/api/pets/${selectedPetId}/service-prices`)
      .then((r) => r.json())
      .then((data: { serviceId: string; price: number }[]) => {
        const map: Record<string, number> = {}
        data.forEach(({ serviceId, price }) => { map[serviceId] = price })
        setPetPriceMap(map)
        setSelectedServices((prev) =>
          prev.map((s) => {
            const cp = map[s.id]
            return cp !== undefined
              ? { ...s, price: cp, isCustomPrice: true }
              : { ...s, price: s.defaultPrice, isCustomPrice: false }
          })
        )
      })
      .catch(() => setPetPriceMap({}))
  }, [selectedPetId])

  // Auto-calculate totals from selected services (non-boarding)
  useEffect(() => {
    if (form.type === "BOARDING") return
    if (selectedServices.length === 0) return
    const totalCost = selectedServices.reduce((sum, s) => sum + s.price, 0)
    const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration ?? 0), 0)
    setForm((f) => ({
      ...f,
      estimatedCost: String(totalCost),
      duration: totalDuration > 0 ? String(totalDuration) : f.duration,
    }))
  }, [selectedServices, form.type])

  // Auto-calculate boarding cost
  useEffect(() => {
    if (form.type !== "BOARDING") return
    const room = rooms.find((r) => r.id === form.boardingRoomId)
    if (!room || !form.scheduledAt || !form.boardingCheckOut) return
    const days = Math.max(1, differenceInDays(new Date(form.boardingCheckOut), new Date(form.scheduledAt)))
    setForm((f) => ({ ...f, estimatedCost: String(days * room.dailyRate) }))
  }, [form.boardingRoomId, form.scheduledAt, form.boardingCheckOut, form.type, rooms])

  // Default scheduledAt = today 10:00
  useEffect(() => {
    const now = new Date()
    now.setHours(10, 0, 0, 0)
    const pad = (n: number) => String(n).padStart(2, "0")
    const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    setForm((f) => ({ ...f, scheduledAt: local }))
  }, [])

  // Pet search debounce
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

  function restorePet(pet: PetResult) {
    setSelectedPet(pet)
    setSelectedPetId(pet.id)
    setPetSearch(`${pet.name}（${pet.breed ?? pet.species}）- ${pet.customer.name}`)
  }

  function selectPet(pet: PetResult) {
    restorePet(pet)
    setShowPetDropdown(false)
    setSelectedServices([])
    try {
      localStorage.setItem("lastAppointmentSelection", JSON.stringify({ petId: pet.id }))
    } catch { /* ignore */ }
  }

  function addService(svc: Service) {
    if (selectedServices.find((s) => s.id === svc.id)) return
    const customPrice = petPriceMap[svc.id]
    setSelectedServices((prev) => [
      ...prev,
      {
        id: svc.id,
        name: svc.name,
        defaultPrice: svc.price,
        price: customPrice !== undefined ? customPrice : svc.price,
        duration: svc.duration,
        isCustomPrice: customPrice !== undefined,
        category: svc.category,
      },
    ])
  }

  function removeService(id: string) {
    setSelectedServices((prev) => prev.filter((s) => s.id !== id))
  }

  const boardingRoom = rooms.find((r) => r.id === form.boardingRoomId)
  const boardingDays =
    form.type === "BOARDING" && form.scheduledAt && form.boardingCheckOut
      ? Math.max(1, differenceInDays(new Date(form.boardingCheckOut), new Date(form.scheduledAt)))
      : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!selectedPetId) { setError("請選擇寵物"); return }
    if (!form.scheduledAt) { setError("請選擇預約時間"); return }
    if (form.type === "BOARDING" && !form.boardingCheckOut) { setError("請選擇預計退房日期"); return }

    setConflict(null)
    setSubmitting(true)
    try {
      let usePlanId: string | null = null

      if (paymentMethod === "MONTHLY_PLAN") {
        usePlanId = selectedPlanId || null
      } else if (paymentMethod === "BUY_AND_USE" && selectedTemplateId) {
        // First create the monthly plan, then use it
        const template = planTemplates.find(t => t.id === selectedTemplateId)
        if (!template) throw new Error("請選擇包月方案")
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + (template.validDays || 30))
        const pricePerSession = template.sessions > 0 ? template.price / template.sessions : 0
        // API 的 parseTaipeiDate 期望 "yyyy-MM-dd"（會補上 T00:00:00+08:00）；
        // 送完整 ISO 字串會組成無效日期而被擋下。用台北時區日期字串。
        const toTaipeiDate = (d: Date) =>
          new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(d)
        const planRes = await fetch(`/api/pets/${selectedPetId}/monthly-plans`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: template.name,
            maxSessions: template.sessions,
            pricePerSession,
            startDate: toTaipeiDate(today),
            endDate: toTaipeiDate(endDate),
          }),
        })
        if (!planRes.ok) {
          const d = await planRes.json().catch(() => ({}))
          throw new Error(d.error || "購買包月失敗")
        }
        const newPlan = await planRes.json()
        usePlanId = newPlan.id
      }

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          petId: selectedPetId,
          staffId: form.staffId || null,
          type: form.type,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          duration: form.duration ? Number(form.duration) : null,
          status: "PENDING",
          services:
            form.type !== "BOARDING"
              ? selectedServices.map(({ name, price, category }) => ({ name, price, category }))
              : [],
          estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
          notes: form.notes || null,
          source: form.source,
          boardingCheckOut: form.boardingCheckOut
            ? new Date(form.boardingCheckOut).toISOString()
            : null,
          boardingRoomId: form.boardingRoomId || null,
          petMonthlyPlanId: usePlanId,
        }),
      })
      if (res.status === 409) {
        const data = await res.json()
        setConflict(data.conflict)
        setSubmitting(false)
        return
      }
      if (!res.ok) throw new Error("建立失敗")
      router.push("/appointments")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "建立預約失敗，請再試一次")
    } finally {
      setSubmitting(false)
    }
  }

  const totalCost = selectedServices.reduce((s, v) => s + v.price, 0)
  const totalDuration = selectedServices.reduce((s, v) => s + (v.duration ?? 0), 0)
  const groupedServices = services.reduce<Record<string, Service[]>>((acc, svc) => {
    const cat = svc.category ?? "其他"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(svc)
    return acc
  }, {})
  const isBoarding = form.type === "BOARDING"

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/appointments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新增預約</h1>
          <p className="text-sm text-gray-500 mt-0.5">填寫預約資訊</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pet search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">選擇寵物</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Label htmlFor="petSearch">搜尋寵物名字 *</Label>
              <Input
                id="petSearch"
                placeholder="輸入寵物名稱或主人姓名..."
                value={petSearch}
                onChange={(e) => {
                  setPetSearch(e.target.value)
                  setShowPetDropdown(true)
                  if (!e.target.value) { setSelectedPet(null); setSelectedPetId("") }
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

            {/* Selected pet info */}
            {selectedPet && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{selectedPet.name}</span>
                    <span className="text-gray-500 ml-1.5">{selectedPet.breed ?? selectedPet.species}</span>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>{selectedPet.customer.name}</p>
                    <p>{selectedPet.customer.phone}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Contract warning */}
            {selectedPet && (() => {
              const contractOk = selectedPet.contract?.status === "SIGNED"
              if (contractOk) return null
              return (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-800 font-medium">
                      {selectedPet.contract ? "合約尚未簽署" : "尚未建立合約"}
                    </p>
                    <p className="text-amber-700 text-xs mt-0.5">
                      建議在預約後前往
                      <Link
                        href={`/customers/${selectedPet.customerId}/pets/${selectedPet.id}`}
                        className="underline font-medium ml-0.5"
                        target="_blank"
                      >
                        寵物頁面
                      </Link>
                      {selectedPet.contract ? "完成簽署" : "建立並簽署合約"}。
                    </p>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>

        {/* Date, Time, Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">預約時間與類型</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="type">預約類型</Label>
                <select
                  id="type"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, boardingRoomId: "", boardingCheckOut: "", estimatedCost: "" }))}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {APPOINTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="source">預約來源</Label>
                <select
                  id="source"
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="scheduledAt">{isBoarding ? "預計入住日期 *" : "預約時間 *"}</Label>
                <div className="relative mt-1.5">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    id="scheduledAt"
                    type={isBoarding ? "date" : "datetime-local"}
                    value={isBoarding ? form.scheduledAt.split("T")[0] : form.scheduledAt}
                    onChange={(e) => {
                      const val = isBoarding ? `${e.target.value}T10:00` : e.target.value
                      setForm((f) => ({ ...f, scheduledAt: val }))
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {isBoarding ? (
                <div>
                  <Label htmlFor="boardingCheckOut">預計退房日期 *</Label>
                  <div className="relative mt-1.5">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      id="boardingCheckOut"
                      type="date"
                      value={form.boardingCheckOut}
                      onChange={(e) => setForm((f) => ({ ...f, boardingCheckOut: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="duration">預計時長（分鐘）</Label>
                  <div className="relative mt-1.5">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input
                      id="duration"
                      type="number"
                      min="0"
                      placeholder="自動從服務計算"
                      value={form.duration}
                      onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
              )}
            </div>

            {!isBoarding && (
              <div>
                <Label htmlFor="staff">負責美容師</Label>
                <select
                  id="staff"
                  value={form.staffId}
                  onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">不指定</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Boarding */}
        {isBoarding && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="h-4 w-4 text-orange-500" />
                住宿設定
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="boardingRoomId">選擇房間</Label>
                <select
                  id="boardingRoomId"
                  value={form.boardingRoomId}
                  onChange={(e) => setForm((f) => ({ ...f, boardingRoomId: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">請選擇空房</option>
                  {rooms.filter((r) => r.status === "AVAILABLE").map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}{r.type ? ` (${r.type})` : ""} · {formatCurrency(r.dailyRate)}/天
                    </option>
                  ))}
                </select>
              </div>

              {boardingDays > 0 && boardingRoom && (
                <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-700">
                    <span>住宿天數</span>
                    <span className="font-medium">{boardingDays} 天</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>每日費用</span>
                    <span className="font-medium">{formatCurrency(boardingRoom.dailyRate)}</span>
                  </div>
                  <div className="flex justify-between border-t border-orange-200 pt-1.5 font-semibold text-orange-700">
                    <span>預估費用</span>
                    <span>{formatCurrency(boardingDays * boardingRoom.dailyRate)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Services */}
        {!isBoarding && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">服務項目</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedServices.length > 0 && (
                <div className="space-y-2 rounded-lg bg-indigo-50 p-3">
                  {selectedServices.map((svc) => (
                    <div key={svc.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => removeService(svc.id)}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-gray-400 hover:text-red-500 shadow-sm shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <span className="font-medium text-gray-900 truncate">{svc.name}</span>
                        {svc.duration && <span className="text-xs text-gray-500 shrink-0">{svc.duration}分</span>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {svc.isCustomPrice
                          ? <span className="text-xs text-amber-600 bg-amber-50 rounded-full px-1.5 py-0.5">專屬定價</span>
                          : <span className="text-xs text-gray-400">預設價格</span>
                        }
                        <span className="font-medium text-indigo-700">{formatCurrency(svc.price)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-indigo-200 pt-2 flex justify-between text-sm font-semibold">
                    <span className="text-gray-700">合計{totalDuration > 0 ? `（約 ${totalDuration} 分鐘）` : ""}</span>
                    <span className="text-indigo-700">{formatCurrency(totalCost)}</span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {Object.entries(groupedServices).map(([category, svcs]) => (
                  <div key={category}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{category}</p>
                    <div className="flex flex-wrap gap-2">
                      {svcs.map((svc) => {
                        const selected = selectedServices.some((s) => s.id === svc.id)
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() => selected ? removeService(svc.id) : addService(svc)}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                              selected
                                ? "border-indigo-500 bg-indigo-600 text-white"
                                : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50"
                            }`}
                          >
                            {!selected && <Plus className="h-3 w-3" />}
                            {svc.name}
                            <span className={selected ? "text-indigo-200" : "text-gray-400"}>
                              {formatCurrency(svc.price)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <Label htmlFor="estimatedCost">預估費用（元）</Label>
                <Input
                  id="estimatedCost"
                  type="number"
                  min="0"
                  placeholder="從服務自動計算，可手動調整"
                  value={form.estimatedCost}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedCost: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly Plan Payment */}
        {!isBoarding && (activePlans.length > 0 || planTemplates.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">付款方式</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("SINGLE")}
                  className={`rounded-xl border p-3 text-sm text-left transition-colors ${
                    paymentMethod === "SINGLE"
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-medium text-gray-900">單次付款</p>
                  <p className="text-xs text-gray-500 mt-0.5">按預估費用結帳</p>
                </button>
                {activePlans.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod("MONTHLY_PLAN")
                      if (activePlans.length === 1) setSelectedPlanId(activePlans[0].id)
                    }}
                    className={`rounded-xl border p-3 text-sm text-left transition-colors ${
                      paymentMethod === "MONTHLY_PLAN"
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="font-medium text-gray-900">使用現有包月</p>
                    <p className="text-xs text-gray-500 mt-0.5">扣除已有包月次數</p>
                  </button>
                )}
                {planTemplates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod("BUY_AND_USE")
                      if (planTemplates.length === 1) setSelectedTemplateId(planTemplates[0].id)
                    }}
                    className={`rounded-xl border p-3 text-sm text-left transition-colors ${
                      paymentMethod === "BUY_AND_USE"
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="font-medium text-gray-900">購買並使用包月</p>
                    <p className="text-xs text-gray-500 mt-0.5">今日購買同時使用一次</p>
                  </button>
                )}
              </div>

              {paymentMethod === "MONTHLY_PLAN" && activePlans.length > 1 && (
                <div>
                  <Label>選擇包月方案</Label>
                  <select
                    value={selectedPlanId}
                    onChange={e => setSelectedPlanId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">請選擇方案</option>
                    {activePlans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}（剩餘 {p.maxSessions - p.usedSessions}/{p.maxSessions} 次）
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {paymentMethod === "MONTHLY_PLAN" && activePlans.length === 1 && (
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-sm">
                  <p className="font-medium text-gray-900">{activePlans[0].name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    已使用 {activePlans[0].usedSessions}/{activePlans[0].maxSessions} 次・完成後自動扣次
                  </p>
                </div>
              )}

              {paymentMethod === "BUY_AND_USE" && planTemplates.length > 1 && (
                <div>
                  <Label>選擇要購買的方案</Label>
                  <select
                    value={selectedTemplateId}
                    onChange={e => setSelectedTemplateId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">請選擇方案</option>
                    {planTemplates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}（{t.sessions}次 / NT${t.price}）
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {paymentMethod === "BUY_AND_USE" && planTemplates.length === 1 && (
                <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-sm">
                  <p className="font-medium text-gray-900">{planTemplates[0].name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {planTemplates[0].sessions} 次 / NT${planTemplates[0].price}・今日購買並使用第 1 次
                  </p>
                </div>
              )}

              {paymentMethod === "BUY_AND_USE" && selectedTemplateId && planTemplates.length > 1 && (() => {
                const t = planTemplates.find(p => p.id === selectedTemplateId)
                return t ? (
                  <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-sm">
                    <p className="text-xs text-gray-500">
                      購買 {t.sessions} 次方案（NT${t.price}），本次預約使用第 1 次，剩餘 {t.sessions - 1} 次
                    </p>
                  </div>
                ) : null
              })()}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">備註</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              placeholder="特殊需求、注意事項..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </CardContent>
        </Card>

        {conflict && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">
            <p className="font-semibold mb-1">⚠️ 時段衝突</p>
            <p>
              所選美容師在同一時段已有預約：<strong>{conflict.petName}</strong>
              （{new Date(conflict.scheduledAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
              {conflict.duration ? `，${conflict.duration}分鐘` : ""}）
            </p>
            <p className="mt-1 text-orange-600">請選擇其他時間或不指定美容師以略過衝突檢查。</p>
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-3 pb-6">
          <Link href="/appointments">
            <Button type="button" variant="outline">取消</Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? "建立中..." : isBoarding ? "建立住宿預約" : "建立預約"}
          </Button>
        </div>
      </form>
    </div>
  )
}
