import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { startOfDay, endOfDay, parseISO } from "date-fns"

async function getSales(shopId: string, date: string) {
  let createdAt: { gte: Date; lte: Date } | undefined
  if (date) {
    try {
      const d = parseISO(date)
      createdAt = { gte: startOfDay(d), lte: endOfDay(d) }
    } catch {}
  }
  return prisma.sale.findMany({
    where: { shopId, ...(createdAt ? { createdAt } : {}) },
    include: {
      customer: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { name: true, unit: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const session = await auth()
  const shopId = session!.user.shopId
  const { date = "" } = await searchParams
  const sales = await getSales(shopId, date)

  const today = new Date().toISOString().split("T")[0]
  const dayTotal = sales.reduce((s, r) => s + r.total, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">銷售紀錄</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {date ? `${date} — ` : ""}共 {sales.length} 筆，合計 {formatCurrency(dayTotal)}
          </p>
        </div>
        <Link href="/sales/new">
          <Button>
            <Plus className="h-4 w-4" />
            結帳
          </Button>
        </Link>
      </div>

      {/* Date filter */}
      <form method="GET" className="flex items-center gap-3">
        <input
          type="date"
          name="date"
          defaultValue={date}
          max={today}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Button type="submit" variant="outline" size="sm">篩選</Button>
        {date && (
          <Link href="/sales">
            <Button variant="ghost" size="sm">清除</Button>
          </Link>
        )}
      </form>

      {/* Sales list */}
      {sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 text-gray-400">
          <ShoppingBag className="h-12 w-12 mb-3" />
          <p className="text-sm">{date ? "此日期無銷售紀錄" : "尚無銷售紀錄"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => (
            <Card key={sale.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatDateTime(sale.createdAt)}
                      </span>
                      {sale.customer && (
                        <Link
                          href={`/customers/${sale.customer.id}`}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          {sale.customer.name}
                        </Link>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {sale.items.map((item) => (
                        <span
                          key={item.id}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {item.product.name} ×{item.qty}
                        </span>
                      ))}
                    </div>
                    {sale.note && (
                      <p className="mt-1 text-xs text-gray-400">{sale.note}</p>
                    )}
                  </div>
                  <p className="text-lg font-bold text-gray-900 shrink-0">
                    {formatCurrency(sale.total)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
