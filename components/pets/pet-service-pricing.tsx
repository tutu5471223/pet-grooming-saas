"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"

interface Service {
  id: string
  name: string
  category: string | null
  price: number
}

interface Props {
  petId: string
  services: Service[]
  initialPrices: { serviceId: string; price: number }[]
}

export function PetServicePricing({ petId, services, initialPrices }: Props) {
  const initMap = Object.fromEntries(initialPrices.map((p) => [p.serviceId, String(p.price)]))
  const [prices, setPrices] = useState<Record<string, string>>(initMap)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleChange(serviceId: string, value: string) {
    setSaved(false)
    setPrices((prev) => ({ ...prev, [serviceId]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const payload = Object.entries(prices)
      .filter(([, v]) => v !== "" && !isNaN(Number(v)))
      .map(([serviceId, v]) => ({ serviceId, price: Number(v) }))

    await fetch(`/api/pets/${petId}/service-prices`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    setSaved(true)
  }

  const grouped = services.reduce<Record<string, Service[]>>((acc, svc) => {
    const cat = svc.category ?? "其他"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(svc)
    return acc
  }, {})

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">專屬服務定價</CardTitle>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600">已儲存</span>}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "儲存中..." : "儲存定價"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-gray-500">
          設定此寵物的專屬價格。預約時若有設定，將自動套用；空白表示使用服務預設價格。
        </p>
        {Object.entries(grouped).map(([category, svcs]) => (
          <div key={category}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              {category}
            </p>
            <div className="space-y-2">
              {svcs.map((svc) => (
                <div key={svc.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-700 min-w-0 truncate">{svc.name}</span>
                  <span className="text-xs text-gray-400 w-20 text-right shrink-0">
                    預設 {formatCurrency(svc.price)}
                  </span>
                  <div className="relative w-28 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                    <Input
                      type="number"
                      min="0"
                      placeholder="專屬價格"
                      value={prices[svc.id] ?? ""}
                      onChange={(e) => handleChange(svc.id, e.target.value)}
                      className="pl-6 h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
