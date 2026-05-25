"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, X, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"

interface Room {
  id: string
  name: string
  type: string | null
  dailyRate: number
  status: string
}

interface Pet {
  id: string
  name: string
  species: string
  breed: string | null
  customer: { name: string }
}

interface Service {
  id: string
  name: string
  category: string | null
  price: number
}

interface AddOnService {
  id: string
  name: string
  price: number
}

export function NewBoardingDialog({ shopId, rooms }: { shopId: string; rooms: Room[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([])

  // Pet search state
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Pet[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState({
    roomId: "",
    checkIn: new Date().toISOString().split("T")[0],
    notes: "",
    priceAdjustment: "",
    priceAdjustmentNote: "",
  })
  const [addOns, setAddOns] = useState<AddOnService[]>([])
  const [showPricing, setShowPricing] = useState(false)

  const availableRooms = rooms.filter((r) => r.status === "AVAILABLE")
  const selectedRoom = rooms.find((r) => r.id === form.roomId)

  useEffect(() => {
    if (!open) {
      setSearchQuery("")
      setSearchResults([])
      setSelectedPet(null)
      setForm({ roomId: "", checkIn: new Date().toISOString().split("T")[0], notes: "", priceAdjustment: "", priceAdjustmentNote: "" })
      setAddOns([])
      setShowPricing(false)
    }
  }, [open])

  useEffect(() => {
    if (open && services.length === 0) {
      fetch("/api/services").then((r) => r.json()).then(setServices).catch(() => {})
    }
  }, [open, services.length])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/pets/all?search=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data: Pet[] = await res.json()
          setSearchResults(data)
          setShowDropdown(true)
        }
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }, [searchQuery])

  function selectPet(pet: Pet) {
    setSelectedPet(pet)
    setSearchQuery("")
    setShowDropdown(false)
    setSearchResults([])
  }

  function clearPet() {
    setSelectedPet(null)
    setSearchQuery("")
  }

  function toggleAddOn(svc: Service) {
    setAddOns((prev) => {
      if (prev.find((a) => a.id === svc.id)) return prev.filter((a) => a.id !== svc.id)
      return [...prev, { id: svc.id, name: svc.name, price: svc.price }]
    })
  }

  const addOnTotal = addOns.reduce((s, a) => s + a.price, 0)
  const adjustment = Number(form.priceAdjustment) || 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPet) return
    setLoading(true)

    await fetch("/api/boarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        petId: selectedPet.id,
        roomId: form.roomId || null,
        checkIn: form.checkIn,
        notes: form.notes || null,
        dailyRate: selectedRoom?.dailyRate ?? 0,
        priceAdjustment: adjustment || null,
        priceAdjustmentNote: form.priceAdjustmentNote || null,
        addOnServices: addOns.length > 0 ? addOns.map(({ name, price }) => ({ name, price })) : null,
      }),
    })

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          新增住宿
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增住宿入住</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Pet search */}
          <div className="space-y-1.5">
            <Label>寵物</Label>
            {selectedPet ? (
              <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                <div>
                  <p className="font-medium text-indigo-900">
                    {selectedPet.name}
                    <span className="ml-1 text-sm font-normal text-indigo-600">
                      （{selectedPet.breed ?? selectedPet.species}）
                    </span>
                  </p>
                  <p className="text-xs text-indigo-600">飼主：{selectedPet.customer.name}</p>
                </div>
                <button type="button" onClick={clearPet} className="text-indigo-400 hover:text-indigo-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="輸入寵物名稱或客人姓名搜尋..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    autoComplete="off"
                  />
                  {searchLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  )}
                </div>
                {showDropdown && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-auto">
                    {searchResults.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-500">查無結果</p>
                    ) : (
                      searchResults.map((pet) => (
                        <button
                          key={pet.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                          onClick={() => selectPet(pet)}
                        >
                          <span className="font-medium text-gray-900">{pet.name}</span>
                          <span className="text-gray-500 ml-1">（{pet.breed ?? pet.species}）</span>
                          <span className="text-gray-400 ml-1">- {pet.customer.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>房間</Label>
            <Select value={form.roomId} onValueChange={(v) => setForm({ ...form, roomId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="選擇空房" />
              </SelectTrigger>
              <SelectContent>
                {availableRooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name} {room.type && `(${room.type})`} · {formatCurrency(room.dailyRate)}/天
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>入住日期</Label>
            <Input
              type="date"
              value={form.checkIn}
              onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>備註</Label>
            <Textarea
              placeholder="特殊需求或注意事項"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>

          {/* Pricing options toggle */}
          <button
            type="button"
            onClick={() => setShowPricing((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800"
          >
            {showPricing ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            附加服務與費用調整
          </button>

          {showPricing && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
              {/* Add-on services */}
              {services.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">附加服務</Label>
                  <div className="flex flex-wrap gap-2">
                    {services.map((svc) => {
                      const selected = addOns.some((a) => a.id === svc.id)
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => toggleAddOn(svc)}
                          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            selected
                              ? "border-indigo-500 bg-indigo-600 text-white"
                              : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300"
                          }`}
                        >
                          {!selected && <Plus className="h-3 w-3" />}
                          {svc.name} {formatCurrency(svc.price)}
                        </button>
                      )
                    })}
                  </div>
                  {addOns.length > 0 && (
                    <p className="text-xs text-indigo-600">
                      附加合計：{formatCurrency(addOnTotal)}
                    </p>
                  )}
                </div>
              )}

              {/* Price adjustment */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">費用調整（元，正數加收/負數折扣）</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.priceAdjustment}
                    onChange={(e) => setForm({ ...form, priceAdjustment: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">調整原因</Label>
                  <Input
                    placeholder="例：節日加價"
                    value={form.priceAdjustmentNote}
                    onChange={(e) => setForm({ ...form, priceAdjustmentNote: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <Button type="submit" disabled={loading || !selectedPet} className="w-full">
            {loading ? "辦理中..." : "確認入住"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
