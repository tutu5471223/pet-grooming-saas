import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, Package, AlertTriangle, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { ProductActions } from "@/components/products/product-actions"

const CATEGORIES = [
  { value: "ALL", label: "全部" },
  { value: "FOOD", label: "食品" },
  { value: "GROOMING", label: "美容用品" },
  { value: "ACCESSORY", label: "配件" },
  { value: "HEALTH", label: "保健" },
]

async function getProducts(shopId: string, category: string, search: string) {
  return prisma.product.findMany({
    where: {
      shopId,
      isActive: true,
      ...(category !== "ALL" ? { category } : {}),
      ...(search
        ? { OR: [{ name: { contains: search } }, { description: { contains: search } }] }
        : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  })
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string }>
}) {
  const session = await auth()
  const shopId = session!.user.shopId
  const { category = "ALL", search = "" } = await searchParams
  const products = await getProducts(shopId, category, search)

  const lowStock = products.filter((p) => p.stock >= 0 && p.stock <= 3)

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">商品管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">共 {products.length} 項商品</p>
        </div>
        <Link href="/products/new">
          <Button>
            <Plus className="h-4 w-4" />
            新增商品
          </Button>
        </Link>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{lowStock.length}</strong> 項商品庫存偏低（≤3）：
            {lowStock.slice(0, 3).map((p) => p.name).join("、")}
            {lowStock.length > 3 && "…"}
          </p>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.value}
              href={`/products?category=${cat.value}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                category === cat.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </div>
        <form method="GET" className="relative">
          <input type="hidden" name="category" value={category} />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            name="search"
            defaultValue={search}
            placeholder="搜尋商品名稱..."
            className="h-9 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>
      </div>

      {/* Product grid */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 text-gray-400">
          <Package className="h-12 w-12 mb-3" />
          <p className="text-sm">尚無商品，點擊「新增商品」開始建立</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {CATEGORIES.find((c) => c.value === product.category)?.label ?? product.category}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-indigo-600 shrink-0">
                    {formatCurrency(product.price)}
                  </p>
                </div>

                {product.description && (
                  <p className="mt-2 text-xs text-gray-500 line-clamp-2">{product.description}</p>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${
                      product.stock === 0
                        ? "bg-red-100 text-red-700"
                        : product.stock <= 3
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    庫存：{product.stock} {product.unit}
                  </span>
                  <ProductActions productId={product.id} productName={product.name} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
