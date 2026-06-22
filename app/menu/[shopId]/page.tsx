import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Clock, Phone, Scissors } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default async function MenuPage({
  params,
}: {
  params: Promise<{ shopId: string }>
}) {
  const { shopId } = await params

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { name: true, phone: true, address: true },
  })

  if (!shop) notFound()

  const services = await prisma.service.findMany({
    where: { shopId, isActive: true, isPublic: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, price: true, duration: true, category: true, description: true },
  })

  // Group by category
  const grouped = services.reduce<Record<string, typeof services>>((acc, svc) => {
    const cat = svc.category ?? "其他"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(svc)
    return acc
  }, {})

  const categoryOrder = ["洗澡", "美容", "單項", "SPA", "其他"]
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ai = categoryOrder.indexOf(a)
    const bi = categoryOrder.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b, "zh-TW")
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-4 pt-10 pb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/20 mb-4">
          <Scissors className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{shop.name}</h1>
        <p className="text-indigo-200 text-sm mt-1">服務價目表</p>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {services.length === 0 ? (
          <div className="text-center text-gray-400 py-16 text-sm">
            目前尚無公開服務項目
          </div>
        ) : (
          sortedCategories.map((category) => (
            <section key={category}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                  {category}
                </span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Service cards */}
              <div className="space-y-2">
                {grouped[category].map((svc) => (
                  <div
                    key={svc.id}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm leading-snug">{svc.name}</p>
                      {svc.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{svc.description}</p>
                      )}
                      {svc.duration && (
                        <p className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <Clock className="h-3 w-3" />
                          約 {svc.duration} 分鐘
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-base font-bold text-indigo-600">
                        {formatCurrency(svc.price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white mt-4 px-4 py-6 text-center space-y-1">
        <p className="text-xs text-gray-400">以上價格僅供參考，實際費用依寵物狀況而定</p>
        {shop.phone && (
          <a
            href={`tel:${shop.phone}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 mt-2"
          >
            <Phone className="h-4 w-4" />
            {shop.phone}
          </a>
        )}
        {shop.address && (
          <p className="text-xs text-gray-400">{shop.address}</p>
        )}
        <p className="text-xs text-gray-300 pt-2">Powered by 寵物美容 SaaS</p>
      </footer>
    </div>
  )
}
