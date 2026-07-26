import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatDate } from "@/lib/utils"
import Link from "next/link"
import { Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CustomerSearch } from "@/components/customers/customer-search"
import { CustomerMergeDialog } from "@/components/customers/customer-merge-dialog"
import { CustomerNotifyDialog } from "@/components/customers/customer-notify-dialog"
import { CustomerCard } from "@/components/customers/customer-card"

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
            // 機能4：以寵物名搜尋也能找到對應客人
            { pets: { some: { name: { contains: search }, isActive: true } } },
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
            const totalGroomings = customer.pets.reduce(
              (sum, p) => sum + p._count.groomingRecords,
              0
            )
            const lastVisit = customer.pets
              .flatMap((p) => p.groomingRecords)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date

            return (
              <CustomerCard
                key={customer.id}
                customer={{
                  id: customer.id,
                  name: customer.name,
                  phone: customer.phone,
                  lineId: customer.lineId,
                  flagType: customer.flagType,
                  flagNote: customer.flagNote,
                  memberLevel: customer.memberLevel
                    ? { name: customer.memberLevel.name, color: customer.memberLevel.color }
                    : null,
                  storedValue: customer.storedValue,
                  points: customer.points,
                  pets: customer.pets.map((p) => ({ id: p.id, name: p.name })),
                  totalGroomings,
                  lastVisitLabel: lastVisit ? formatDate(lastVisit) : null,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
