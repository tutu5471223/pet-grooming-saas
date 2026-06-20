import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatDate, formatCurrency, contractStatusLabel } from "@/lib/utils"
import Link from "next/link"
import {
  Plus,
  Phone,
  PawPrint,
  ChevronRight,
  Users,
  Wallet,
  Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CustomerSearch } from "@/components/customers/customer-search"
import { CustomerMergeDialog } from "@/components/customers/customer-merge-dialog"
import { CustomerNotifyDialog } from "@/components/customers/customer-notify-dialog"

const FLAG_ICONS: Record<string, string> = {
  WARNING: "⚠️",
  BLOCKED: "🚫",
  VIP: "⭐",
}

async function getCustomers(shopId: string, search: string) {
  return prisma.customer.findMany({
    where: {
      shopId,
      status: { not: "MERGED" },
      OR: search
        ? [
            { name: { contains: search } },
            { phone: { contains: search } },
            { lineId: { contains: search } },
          ]
        : undefined,
    },
    include: {
      memberLevel: true,
      pets: {
        where: { isActive: true },
        include: {
          contract: true,
          groomingRecords: { orderBy: { date: "desc" }, take: 1 },
          _count: { select: { groomingRecords: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const session = await auth()
  const shopId = session!.user.shopId
  const isAdmin = session!.user.role === "OWNER"
  const { search = "" } = await searchParams
  const [customers, memberLevels] = await Promise.all([
    getCustomers(shopId, search),
    prisma.memberLevel.findMany({ where: { shopId }, orderBy: { minPoints: "asc" } }),
  ])

  const customersForDialog = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    lineId: c.lineId,
    memberLevelId: c.memberLevelId,
    memberLevel: c.memberLevel,
    pets: c.pets.map((p) => ({ groomingRecords: p.groomingRecords.map((r) => ({ date: r.date.toISOString() })) })),
  }))

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">客人管理</h1>
          <p className="text-sm text-gray-500 mt-1">共 {customers.length} 位客人</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CustomerNotifyDialog customers={customersForDialog} memberLevels={memberLevels} />
          {isAdmin && (
            <CustomerMergeDialog
              customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
            />
          )}
          <Link href="/customers/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              新增客人
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <CustomerSearch defaultValue={search} />

      {/* Customer list */}
      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 text-gray-400">
          <Users className="h-12 w-12 mb-3" />
          <p className="text-base font-medium">找不到客人</p>
          <p className="text-sm mt-1">
            {search ? "試試其他關鍵字" : "點擊右上角新增第一位客人"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map((customer) => {
            const totalPets = customer.pets.length
            const totalGroomings = customer.pets.reduce(
              (sum, p) => sum + p._count.groomingRecords,
              0
            )
            const lastVisit = customer.pets
              .flatMap((p) => p.groomingRecords)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date

            const flagIcon = customer.flagType ? FLAG_ICONS[customer.flagType] : null

            return (
              <Link key={customer.id} href={`/customers/${customer.id}`}>
                <Card className={`cursor-pointer hover:shadow-md transition-shadow ${
                  customer.flagType === "BLOCKED" ? "border-red-200 bg-red-50/30" :
                  customer.flagType === "WARNING" ? "border-yellow-200 bg-yellow-50/30" :
                  customer.flagType === "VIP" ? "border-yellow-300 bg-yellow-50/20" : ""
                }`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-lg">
                        {customer.name[0]}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {flagIcon && <span>{flagIcon}</span>}
                          <span className="font-semibold text-gray-900">{customer.name}</span>
                          {customer.memberLevel && (
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                              style={{ backgroundColor: customer.memberLevel.color }}
                            >
                              {customer.memberLevel.name}
                            </span>
                          )}
                          {customer.flagType === "BLOCKED" && (
                            <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">拒絕服務</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {customer.phone}
                          </span>
                          {customer.lineId && (
                            <span className="text-green-600">LINE: {customer.lineId}</span>
                          )}
                        </div>
                        {customer.flagNote && (
                          <p className="mt-1 text-xs text-gray-500 italic">{customer.flagNote}</p>
                        )}

                        {/* Stats row */}
                        <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                          <span className="flex items-center gap-1.5 text-xs text-gray-600">
                            <PawPrint className="h-3.5 w-3.5 text-indigo-400" />
                            {totalPets} 隻寵物
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Wallet className="h-3.5 w-3.5 text-green-400" />
                            儲值 {formatCurrency(customer.storedValue)}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Star className="h-3.5 w-3.5 text-yellow-400" />
                            {customer.points} 點
                          </span>
                          {totalGroomings > 0 && (
                            <span className="text-xs text-gray-500">
                              美容 {totalGroomings} 次・
                              上次到店 {formatDate(lastVisit)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="h-5 w-5 text-gray-400 shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
