"use client"

import { useState, use, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Camera, X, CalendarCheck } from "lucide-react"
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
import { formatCurrency } from "@/lib/utils"

interface Service {
  name: string
  price: number
}

interface ApiService {
  id: string
  name: string
  price: number
}

interface User {
  id: string
  name: string
}

function NewGroomingPageContent({
  params,
}: {
  params: Promise<{ id: string; petId: string }>
}) {
  const { id: customerId, petId } = use(params)
  const searchParams = useSearchParams()
  const appointmentId = searchParams.get("appointmentId") ?? null
  const preDate = searchParams.get("date") ?? null
  const preStaffId = searchParams.get("staffId") ?? null
  const preServices = searchParams.get("services") ?? null

  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [staffList, setStaffList] = useState<User[]>([])
  const [serviceOptions, setServiceOptions] = useState<ApiService[]>([])
  const [petPriceMap, setPetPriceMap] = useState<Record<string, number>>({})

  const [services, setServices] = useState<Service[]>(() => {
    if (preServices) {
      try {
        const svcs = JSON.parse(decodeURIComponent(preServices)) as { name: string; price: number }[]
        if (svcs.length > 0) return svcs
      } catch {}
    }
    return [{ name: "", price: 0 }]
  })

  const [form, setForm] = useState({
    groomerId: preStaffId ?? "",
    products: "",
    skinCondition: "",
    furCondition: "",
    notes: "",
    date: preDate ?? new Date().toISOString().split("T")[0],
  })

  const [beforePhotoUrl, setBeforePhotoUrl] = useState<string | null>(null)
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState<"before" | "after" | null>(null)
  const beforeInputRef = useRef<HTMLInputElement>(null)
  const afterInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/staff").then(r => r.json()).then(setStaffList).catch(() => {})
    fetch("/api/services").then(r => r.json()).then(setServiceOptions).catch(() => {})
    fetch(`/api/pets/${petId}/service-prices`)
      .then(r => r.json())
      .then((data: { serviceId: string; price: number }[]) => {
        const map: Record<string, number> = {}
        data.forEach(({ serviceId, price }) => { map[serviceId] = price })
        setPetPriceMap(map)
      })
      .catch(() => {})
  }, [customerId, petId])

  function addService() {
    setServices([...services, { name: "", price: 0 }])
  }

  function removeService(idx: number) {
    setServices(services.filter((_, i) => i !== idx))
  }

  function updateService(idx: number, field: keyof Service, value: string | number) {
    const updated = [...services]
    if (field === "price") {
      updated[idx][field] = Number(value)
    } else {
      updated[idx][field] = value as string
    }
    setServices(updated)
  }

  function selectServiceOption(idx: number, name: string) {
    const option = serviceOptions.find((s) => s.name === name)
    if (option) {
      const updated = [...services]
      const petPrice = petPriceMap[option.id]
      updated[idx] = { name: option.name, price: petPrice !== undefined ? petPrice : option.price }
      setServices(updated)
    }
  }

  async function handlePhotoUpload(file: File, slot: "before" | "after") {
    setPhotoUploading(slot)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "上傳失敗") }
      const { url } = await res.json()
      slot === "before" ? setBeforePhotoUrl(url) : setAfterPhotoUrl(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "上傳失敗")
    } finally {
      setPhotoUploading(null)
    }
  }

  const totalCost = services.reduce((sum, s) => sum + (s.price || 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (services.some((s) => !s.name)) {
      setError("請填寫所有服務項目名稱")
      return
    }
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/grooming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          petId,
          ...form,
          groomerId: form.groomerId || null,
          services,
          totalCost,
          beforePhotoUrl,
          afterPhotoUrl,
          appointmentId: appointmentId ?? undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "建立失敗")
      }

      router.push(`/customers/${customerId}/pets/${petId}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "建立失敗")
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/customers/${customerId}/pets/${petId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新增美容完工紀錄</h1>
          <p className="text-sm text-gray-500 mt-0.5">記錄本次美容服務內容</p>
        </div>
      </div>

      {/* Appointment origin banner */}
      {appointmentId && (
        <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
          <CalendarCheck className="h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">從預約建立</p>
            <p className="text-xs text-blue-600">
              完工儲存後，該預約狀態將自動更新為「已完成」
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="date">美容日期</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>美容師</Label>
                <Select
                  value={form.groomerId}
                  onValueChange={(v) => setForm({ ...form, groomerId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇美容師" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">服務項目</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addService}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {services.map((svc, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-1">
                  <Select onValueChange={(v) => selectServiceOption(idx, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇服務" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.name}>
                          {opt.name} ({formatCurrency(opt.price)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  placeholder="服務名稱"
                  value={svc.name}
                  onChange={(e) => updateService(idx, "name", e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="金額"
                  value={svc.price || ""}
                  onChange={(e) => updateService(idx, "price", e.target.value)}
                  className="w-28"
                  min={0}
                />
                {services.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeService(idx)}
                    className="shrink-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-900">
                合計：{formatCurrency(totalCost)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pet condition */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">寵物狀況紀錄</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="products">使用產品</Label>
              <Input
                id="products"
                placeholder="例：法國 ISB 洗毛精、潤毛精..."
                value={form.products}
                onChange={(e) => setForm({ ...form, products: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="skinCondition">皮膚狀況</Label>
                <Input
                  id="skinCondition"
                  placeholder="例：皮膚狀況良好"
                  value={form.skinCondition}
                  onChange={(e) => setForm({ ...form, skinCondition: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="furCondition">毛況</Label>
                <Input
                  id="furCondition"
                  placeholder="例：毛質柔順，無打結"
                  value={form.furCondition}
                  onChange={(e) => setForm({ ...form, furCondition: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">備註</Label>
              <Textarea
                id="notes"
                placeholder="其他特殊狀況或客人要求..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">美容前後照片</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {(["before", "after"] as const).map((slot) => {
                const url = slot === "before" ? beforePhotoUrl : afterPhotoUrl
                const inputRef = slot === "before" ? beforeInputRef : afterInputRef
                const uploading = photoUploading === slot
                return (
                  <div key={slot} className="space-y-2">
                    <p className="text-xs font-medium text-gray-600">
                      {slot === "before" ? "美容前" : "美容後"}
                    </p>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handlePhotoUpload(file, slot)
                        e.target.value = ""
                      }}
                    />
                    {url ? (
                      <div className="relative rounded-xl overflow-hidden aspect-square border border-gray-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={slot} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => slot === "before" ? setBeforePhotoUrl(null) : setAfterPhotoUrl(null)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                        className="w-full aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-indigo-400 hover:text-indigo-400 transition-colors disabled:opacity-50"
                      >
                        <Camera className="h-8 w-8" />
                        <span className="text-xs">{uploading ? "上傳中..." : "點擊上傳"}</span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Payment info banner */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          完工後款項將進入<strong>應收帳款</strong>，請至「營收報表 → 應收帳款」收款。
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pb-6">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "儲存中..." : "完工並儲存"}
          </Button>
          <Link href={`/customers/${customerId}/pets/${petId}`}>
            <Button type="button" variant="outline">取消</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}

export default function NewGroomingPage({
  params,
}: {
  params: Promise<{ id: string; petId: string }>
}) {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">載入中...</div>}>
      <NewGroomingPageContent params={params} />
    </Suspense>
  )
}
