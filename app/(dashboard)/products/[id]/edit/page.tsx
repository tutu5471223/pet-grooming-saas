"use client"

import { useState, useEffect, use } from "react"
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

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    name: "",
    category: "GROOMING",
    price: "",
    stock: "",
    unit: "個",
    description: "",
    isActive: true,
  })

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("找不到商品")
        return r.json()
      })
      .then((p) => {
        setForm({
          name: p.name,
          category: p.category,
          price: String(p.price),
          stock: String(p.stock),
          unit: p.unit,
          description: p.description ?? "",
          isActive: p.isActive,
        })
      })
      .catch((err) => setError(err.message))
      .finally(() => setFetching(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          stock: Number(form.stock),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "更新失敗")
      }
      router.push("/products")
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "更新失敗")
      setLoading(false)
    }
  }

  if (fetching) {
    return <div className="p-6 text-gray-500">載入中...</div>
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
          <h1 className="text-2xl font-bold text-gray-900">編輯商品</h1>
          <p className="text-sm text-gray-500 mt-0.5">{form.name}</p>
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
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock">目前庫存</Label>
                <Input
                  id="stock"
                  type="number"
                  min={0}
                  step={1}
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">商品說明</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                商品上架中（取消勾選則下架）
              </label>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "儲存中..." : "儲存變更"}
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
