"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Search, Plus, Minus, Trash2, AlertTriangle, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

interface Product {
  id: string
  name: string
  category: string
  price: number
  stock: number
  unit: string
}

interface CartItem {
  product: Product
  qty: number
  price: number
}

interface Customer {
  id: string
  name: string
  phone: string
}

const CATEGORY_LABELS: Record<string, string> = {
  FOOD: "食品",
  GROOMING: "美容用品",
  ACCESSORY: "配件",
  HEALTH: "保健",
}

export default function NewSalePage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerSearch, setCustomerSearch] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Load all products on mount
  useEffect(() => {
    fetch("/api/products?includeInactive=false")
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => {})
  }, [])

  // Customer search debounce
  useEffect(() => {
    if (!customerSearch.trim() || customerSearch.length < 1) {
      setCustomers([])
      return
    }
    const t = setTimeout(() => {
      fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}`)
        .then((r) => r.json())
        .then((data: Customer[]) => setCustomers(data.slice(0, 6)))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch])

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    CATEGORY_LABELS[p.category]?.includes(search)
  )

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
        )
      }
      return [...prev, { product, qty: 1, price: product.price }]
    })
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, qty: Math.max(1, i.qty + delta) } : i
        )
        .filter((i) => i.qty > 0)
    )
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
  }

  function updatePrice(productId: string, price: string) {
    const p = Number(price)
    if (!Number.isFinite(p) || p < 0) return
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, price: p } : i))
    )
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const lowStockItems = cart.filter((i) => i.qty > i.product.stock)

  async function handleCheckout() {
    if (cart.length === 0) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.id ?? null,
          note: note.trim() || null,
          items: cart.map((i) => ({
            productId: i.product.id,
            qty: i.qty,
            price: i.price,
          })),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "結帳失敗")
      }
      router.push("/sales")
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "結帳失敗")
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/sales">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">結帳</h1>
          <p className="text-sm text-gray-500 mt-0.5">選擇商品加入購物車後結帳</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Product selection */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">選擇商品</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="搜尋商品名稱或分類..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {filteredProducts.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">
                  {products.length === 0 ? "尚無商品，請先新增商品" : "找不到符合的商品"}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
                  {filteredProducts.map((product) => {
                    const inCart = cart.find((i) => i.product.id === product.id)
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addToCart(product)}
                        className={`text-left rounded-xl border p-3 transition-colors hover:border-indigo-400 hover:bg-indigo-50 ${
                          inCart ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                            <p className="text-xs text-gray-400">
                              {CATEGORY_LABELS[product.category] ?? product.category}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-indigo-600">
                              {formatCurrency(product.price)}
                            </p>
                            <p className={`text-xs ${product.stock <= 3 ? "text-amber-600" : "text-gray-400"}`}>
                              庫存 {product.stock}
                            </p>
                          </div>
                        </div>
                        {inCart && (
                          <div className="mt-1.5 text-xs text-indigo-600 font-medium">
                            已加入 ×{inCart.qty}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Cart + checkout */}
        <div className="lg:col-span-2 space-y-4">
          {/* Cart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                購物車
                {cart.length > 0 && (
                  <span className="ml-auto text-xs font-normal text-gray-500">
                    {cart.length} 項商品
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-4">點擊左側商品加入購物車</p>
              ) : (
                <>
                  {lowStockItems.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        {lowStockItems.map((i) => i.product.name).join("、")} 庫存不足，仍可結帳
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={item.product.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-sm font-medium text-gray-900 truncate flex-1">
                            {item.product.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-gray-400 hover:text-red-500 shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateQty(item.product.id, -1)}
                              className="h-6 w-6 rounded border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-100"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => updateQty(item.product.id, 1)}
                              className="h-6 w-6 rounded border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-100"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="text-xs text-gray-400">×</span>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={item.price}
                            onChange={(e) => updatePrice(item.product.id, e.target.value)}
                            className="h-7 w-20 text-sm px-2"
                          />
                          <span className="text-xs text-gray-500 ml-auto shrink-0">
                            = {formatCurrency(item.price * item.qty)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">合計</span>
                    <span className="text-xl font-bold text-indigo-600">{formatCurrency(total)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Customer (optional) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">客人（選填）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-indigo-900">{selectedCustomer.name}</p>
                    <p className="text-xs text-indigo-600">{selectedCustomer.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedCustomer(null); setCustomerSearch("") }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    清除
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="搜尋客人姓名或電話..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                  {customers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
                      {customers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); setCustomers([]) }}
                          className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">{c.name}</span>
                          <span className="text-gray-400">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="note">備註（選填）</Label>
            <Input
              id="note"
              placeholder="例：線上訂單、折扣說明..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={cart.length === 0 || submitting}
          >
            {submitting ? "結帳中..." : `確認結帳 ${cart.length > 0 ? formatCurrency(total) : ""}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
