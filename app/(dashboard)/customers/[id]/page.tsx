import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Phone,
  MapPin,
  Plus,
  PawPrint,
  Wallet,
  Star,
  Edit,
  ChevronRight,
  FileText,
  Scissors,
  CalendarDays,
  CreditCard,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { formatCurrency, formatDate, formatDateTime, contractStatusLabel } from "@/lib/utils"
import { StoredValueTopupButton } from "@/components/customers/stored-value-topup-button"
import { PointsAdjustButton } from "@/components/customers/points-adjust-button"
import { CustomerFlagButton } from "@/components/customers/customer-flag-button"

async function getCustomer(id: string, shopId: string) {
  return prisma.customer.findFirst({
    where: { id, shopId },
    include: {
      memberLevel: true,
      monthlyPlan: true,
      pets: {
        where: { isActive: true },
        include: {
          contract: true,
          groomingRecords: { orderBy: { date: "desc" }, take: 1 },
          _count: { select: { groomingRecords: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      payments: { orderBy: { paidAt: "desc" }, take: 10 },
      pointsHistories: { orderBy: { createdAt: "desc" }, take: 10 },
      storedValueHistories: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  })
}

// Separate query so a missing PetMonthlyPlan table doesn't crash the whole page
async function getPetMonthlyPlans(shopId: string, petIds: string[]) {
  if (petIds.length === 0) return []
  try {
    return await prisma.petMonthlyPlan.findMany({
      where: { shopId, petId: { in: petIds } },
      orderBy: { startDate: "desc" },
    })
  } catch {
    return []
  }
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const shopId = session!.user.shopId
  const { id } = await params
  const [customer, allMemberLevels] = await Promise.all([
    getCustomer(id, shopId),
    prisma.memberLevel.findMany({ where: { shopId }, orderBy: { minPoints: "asc" } }),
  ])

  if (!customer) notFound()

  const petMonthlyPlans = await getPetMonthlyPlans(shopId, customer.pets.map((p) => p.id))

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/customers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{customer.name}</h1>
              {customer.memberLevel && (
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: customer.memberLevel.color }}
                >
                  {customer.memberLevel.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {customer.phone}
              </span>
              {customer.lineId && <span className="text-green-600">LINE: {customer.lineId}</span>}
              {customer.idNumber && <span>身分證：{customer.idNumber}</span>}
              {customer.address && (
                <span className="flex items-center gap-1 min-w-0">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{customer.address}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CustomerFlagButton
            customerId={customer.id}
            currentFlagType={customer.flagType}
            currentFlagNote={customer.flagNote}
          />
          <Link href={`/customers/${customer.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4" />
              編輯
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-medium">儲值餘額</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(customer.storedValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-600 mb-1">
              <Star className="h-4 w-4" />
              <span className="text-xs font-medium">點數</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{customer.points} 點</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <PawPrint className="h-4 w-4" />
              <span className="text-xs font-medium">寵物數量</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{customer.pets.length} 隻</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <Scissors className="h-4 w-4" />
              <span className="text-xs font-medium">累計美容</span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {customer.pets.reduce((sum, p) => sum + p._count.groomingRecords, 0)} 次
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Membership level progress */}
      {(() => {
        const sortedLevels = [...allMemberLevels].sort((a, b) => a.minPoints - b.minPoints)
        const currentPoints = customer.points
        const currentLevel = customer.memberLevel
        const nextLevel = sortedLevels.find((l) => l.minPoints > currentPoints)
        if (!nextLevel) return null
        const prevMin = currentLevel?.minPoints ?? 0
        const pct = Math.min(100, Math.round(((currentPoints - prevMin) / (nextLevel.minPoints - prevMin)) * 100))
        const needed = nextLevel.minPoints - currentPoints
        return (
          <div className="rounded-xl border border-gray-200 p-4 bg-white">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">距下一等級 <strong style={{ color: nextLevel.color }}>{nextLevel.name}</strong></span>
              <span className="text-gray-500">還需 <strong>{needed}</strong> 點</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100">
              <div
                className="h-2.5 rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: nextLevel.color }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{currentPoints} / {nextLevel.minPoints} 點</p>
          </div>
        )
      })()}

      {/* Pet Monthly Plans — 唯讀顯示 */}
      {(() => {
        const allPetPlans = petMonthlyPlans.map((plan) => ({
          ...plan,
          petName: customer.pets.find((p) => p.id === plan.petId)?.name ?? "",
        }))
        if (allPetPlans.length === 0) {
          return (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-4 py-3">
              <CreditCard className="h-4 w-4 text-gray-300" />
              <span className="text-sm text-gray-400">名下寵物尚無包月方案，請至個別寵物頁面新增</span>
            </div>
          )
        }
        const now = new Date()
        return (
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-gray-100">
              <CreditCard className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-gray-700">寵物包月方案（唯讀）</span>
              <span className="text-xs text-gray-400 ml-auto">如需新增請至寵物頁面</span>
            </div>
            <div className="divide-y divide-gray-50">
              {allPetPlans.map((plan) => {
                const end = new Date(plan.endDate)
                const isActive = now >= new Date(plan.startDate) && now <= end && plan.usedSessions < plan.maxSessions
                const remaining = plan.maxSessions - plan.usedSessions
                return (
                  <div key={plan.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {isActive ? "有效" : now < new Date(plan.startDate) ? "未開始" : plan.usedSessions >= plan.maxSessions ? "次數用完" : "已到期"}
                      </span>
                      <Link href={`/customers/${customer.id}/pets/${plan.petId}?tab=monthly-plans`} className="font-medium text-gray-900 hover:text-indigo-600 shrink-0">
                        {plan.petName}
                      </Link>
                      <span className="text-gray-500 truncate">{plan.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0 ml-2">
                      <span>剩 <strong>{Math.max(0, remaining)}</strong> 次</span>
                      <span>到期 {formatDate(end)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      <Tabs defaultValue="pets">
        <TabsList>
          <TabsTrigger value="pets">寵物列表</TabsTrigger>
          <TabsTrigger value="payments">付款紀錄</TabsTrigger>
          <TabsTrigger value="points">點數紀錄</TabsTrigger>
          <TabsTrigger value="stored">儲值紀錄</TabsTrigger>
        </TabsList>

        {/* Pets Tab */}
        <TabsContent value="pets" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">名下寵物</h2>
            <Link href={`/customers/${customer.id}/pets/new`}>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                新增寵物
              </Button>
            </Link>
          </div>

          {customer.pets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-12 text-gray-400">
              <PawPrint className="h-10 w-10 mb-2" />
              <p className="text-sm">尚未新增寵物</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {customer.pets.map((pet) => {
                const cs = contractStatusLabel(pet.contract?.status ?? "PENDING")
                const lastGrooming = pet.groomingRecords[0]
                return (
                  <Card key={pet.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-2xl shrink-0">
                          {pet.species === "犬" ? "🐕" : pet.species === "貓" ? "🐈" : "🐾"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <Link href={`/customers/${customer.id}/pets/${pet.id}`} className="flex-1">
                              <span className="font-semibold text-gray-900 hover:text-indigo-600">{pet.name}</span>
                              <span className="ml-2 text-sm text-gray-500">
                                {pet.breed ?? pet.species}
                              </span>
                            </Link>
                            <Link
                              href={`/appointments/new?petId=${pet.id}`}
                            >
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs shrink-0 ml-2">
                                <Calendar className="h-3 w-3 mr-1" />
                                預約
                              </Button>
                            </Link>
                          </div>

                          <div className="flex flex-wrap gap-2 mt-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cs.color}`}
                            >
                              <FileText className="h-3 w-3" />
                              {cs.label}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-600">
                              <Scissors className="h-3 w-3" />
                              美容 {pet._count.groomingRecords} 次
                            </span>
                          </div>

                          {lastGrooming && (
                            <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              上次到店 {formatDate(lastGrooming.date)}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {customer.payments.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p className="text-sm">暫無付款紀錄</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3 text-left font-medium text-gray-500 whitespace-nowrap">時間</th>
                        <th className="px-5 py-3 text-left font-medium text-gray-500 whitespace-nowrap">金額</th>
                        <th className="px-5 py-3 text-left font-medium text-gray-500 whitespace-nowrap">方式</th>
                        <th className="px-5 py-3 text-left font-medium text-gray-500">備註</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {customer.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="px-5 py-3 text-gray-700 whitespace-nowrap">{formatDate(p.paidAt)}</td>
                          <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="px-5 py-3 text-gray-700 whitespace-nowrap">{p.paymentMethod ?? "—"}</td>
                          <td className="px-5 py-3 text-gray-500">{p.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Points Tab */}
        <TabsContent value="points" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">點數紀錄</h2>
            <PointsAdjustButton customerId={customer.id} />
          </div>
          <Card>
            <CardContent className="p-0">
              {customer.pointsHistories.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p className="text-sm">暫無點數紀錄</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3 text-left font-medium text-gray-500 whitespace-nowrap">時間</th>
                        <th className="px-5 py-3 text-left font-medium text-gray-500 whitespace-nowrap">點數異動</th>
                        <th className="px-5 py-3 text-left font-medium text-gray-500">原因</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {customer.pointsHistories.map((h) => (
                        <tr key={h.id}>
                          <td className="px-5 py-3 text-gray-700 whitespace-nowrap">{formatDateTime(h.createdAt)}</td>
                          <td className={`px-5 py-3 font-medium whitespace-nowrap ${h.points > 0 ? "text-green-600" : "text-red-600"}`}>
                            {h.points > 0 ? "+" : ""}{h.points} 點
                          </td>
                          <td className="px-5 py-3 text-gray-700">{h.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stored Value Tab */}
        <TabsContent value="stored" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">儲值紀錄</h2>
            <StoredValueTopupButton customerId={customer.id} />
          </div>
          <Card>
            <CardContent className="p-0">
              {customer.storedValueHistories.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p className="text-sm">暫無儲值紀錄</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3 text-left font-medium text-gray-500 whitespace-nowrap">時間</th>
                        <th className="px-5 py-3 text-left font-medium text-gray-500 whitespace-nowrap">金額異動</th>
                        <th className="px-5 py-3 text-left font-medium text-gray-500">原因</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {customer.storedValueHistories.map((h) => (
                        <tr key={h.id}>
                          <td className="px-5 py-3 text-gray-700 whitespace-nowrap">{formatDateTime(h.createdAt)}</td>
                          <td className={`px-5 py-3 font-medium whitespace-nowrap ${h.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                            {h.amount > 0 ? "+" : ""}{formatCurrency(h.amount)}
                          </td>
                          <td className="px-5 py-3 text-gray-700">{h.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {customer.notes && (
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-gray-500 mb-1">備註</p>
            <p className="text-sm text-gray-700">{customer.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
