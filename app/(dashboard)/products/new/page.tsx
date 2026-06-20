"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
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

const CATEGORIES = [
  { value: "FOOD", label: "食品" },
  { value: "GROOMING", label: "美容用品" },
  { value: "ACCESSORY", label: "配件" },
  { value: "HEALTH", label: "保健" },
]

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    name: "",
    category: "GROOMING",
    price: "",
    stock: "0",
    unit: "個",
    description: "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          stock: Number(form.stock),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "建立失敗")
      }
      router.push("/products")
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "建立失敗")
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新增商品</h1>
          <p className="text-sm text-gray-500 mt-0.5">填寫商品基本資料</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">商品資料</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">商品名稱 *</Label>
              <Input
                id="name"
                placeholder="例：法國 ISB 洗毛精 500ml"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>分類</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit">單位</Label>
                <Input
                  id="unit"
                  placeholder="個、瓶、包..."
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="price">售價（元）*</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock">初始庫存</Label>
                <Input
                  id="stock"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">商品說明</Label>
              <Textarea
                id="description"
                placeholder="容量、成分、用途等說明..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "建立中..." : "建立商品"}
              </Button>
              <Link href="/products">
                <Button type="button" variant="outline">取消</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
