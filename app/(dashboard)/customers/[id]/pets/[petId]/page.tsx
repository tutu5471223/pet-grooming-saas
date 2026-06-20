import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
  FileText,
  Scissors,
  Home,
  Calendar,
  Plus,
  ExternalLink,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { GroomingShareButton } from "@/components/pets/grooming-share-button"
import { ContractActions } from "@/components/pets/contract-actions"
import { PetPhotoUpload } from "@/components/pets/pet-photo-upload"
import { VaccineManager, type VaccineRecord } from "@/components/pets/vaccine-manager"
import { ContractPDFDownload } from "@/components/contracts/contract-pdf-download"
import { PetServicePricing } from "@/components/pets/pet-service-pricing"
import { PetMonthlyPlanManager } from "@/components/pets/pet-monthly-plan-manager"
import { GroomingRecordActions } from "@/components/pets/grooming-record-actions"
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  genderLabel,
  contractStatusLabel,
  appointmentStatusLabel,
  boardingStatusLabel,
} from "@/lib/utils"
import { differenceInYears, differenceInMonths } from "date-fns"

async function getShopName(shopId: string) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { name: true } })
  return shop?.name ?? "寵物美容店"
}

async function getPet(id: string, shopId: string) {
  try {
    return await prisma.pet.findFirst({
      where: { id, shopId, isActive: true },
      include: {
        customer: true,
        contract: true,
        groomingRecords: {
          include: { groomer: true },
          orderBy: { date: "desc" },
        },
        boardingRecords: {
          include: { room: true },
          orderBy: { checkIn: "desc" },
        },
        appointments: {
          include: { staff: true },
          orderBy: { scheduledAt: "desc" },
          take: 10,
        },
        petMonthlyPlans: {
          orderBy: { startDate: "desc" },
        },
      },
    })
  } catch (error) {
    console.error("getPet error:", error)
    return null
  }
}

async function getServicesAndPrices(shopId: string, petId: string) {
  const [services, petPrices] = await Promise.all([
    prisma.service.findMany({
      where: { shopId, isActive: true },
      select: { id: true, name: true, category: true, price: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.petServicePrice.findMany({
      where: { petId, shopId },
      select: { serviceId: true, price: true },
    }),
  ])
  return { services, petPrices }
}

function calcAge(birthday: Date | null): string {
  if (!birthday) return "未知"
  const now = new Date()
  const years = differenceInYears(now, birthday)
  if (years > 0) return `${years} 歲`
  const months = differenceInMonths(now, birthday)
  return `${months} 個月`
}

export default async function PetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; petId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await auth()
  const shopId = session!.user.shopId
  const { id: customerId, petId } = await params
  const { tab: initialTab } = await searchParams
  const [pet, shopName, { services, petPrices }, staffList] = await Promise.all([
    getPet(petId, shopId),
    getShopName(shopId),
    getServicesAndPrices(shopId, petId),
    prisma.user.findMany({ where: { shopId, isActive: true }, select: { id: true, name: true } }),
  ])

  if (!pet) notFound()

  const cs = contractStatusLabel(pet.contract?.status ?? "PENDING")
  const hdrs = await headers()
  const host = hdrs.get("host") ?? "localhost:3000"
  const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"
  const baseUrl = `${protocol}://${host}`
  const vaccineRecords: VaccineRecord[] = (() => {
    if (!pet.vaccineRecords) return []
    try { return JSON.parse(pet.vaccineRecords) as VaccineRecord[] } catch { return [] }
  })()

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/customers" className="hover:text-gray-700">客人管理</Link>
        <span>/</span>
        <Link href={`/customers/${customerId}`} className="hover:text-gray-700">
          {pet.customer.name}
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{pet.name}</span>
      </div>

      {/* Pet header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            {pet.photoUrl ? (
              <div className="relative h-16 w-16 rounded-2xl overflow-hidden border border-gray-200">
                <img src={pet.photoUrl} alt={pet.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-4xl">
                {pet.species === "犬" ? "🐕" : pet.species === "貓" ? "🐈" : "🐾"}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{pet.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500 flex-wrap">
              <span>{pet.breed ?? pet.species}</span>
              <span>·</span>
              <span>{genderLabel(pet.gender)}</span>
              <span>·</span>
              <span>{calcAge(pet.birthday)}</span>
              {pet.birthday && (
                <>
                  <span>·</span>
                  <span>生日 {formatDate(pet.birthday)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Link href={`/customers/${customerId}/pets/${petId}/edit`}>
          <Button variant="outline" size="sm">編輯寵物資料</Button>
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">合約狀態</span>
            </div>
            <span className={`text-sm font-semibold ${cs.color} rounded-full px-2 py-0.5`}>
              {cs.label}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Scissors className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-gray-500">美容次數</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{pet.groomingRecords.length} 次</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-gray-500">上次到店</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {pet.groomingRecords[0]
                ? formatDate(pet.groomingRecords[0].date)
                : "尚未美容"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Home className="h-4 w-4 text-green-400" />
              <span className="text-xs text-gray-500">住宿紀錄</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{pet.boardingRecords.length} 次</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={initialTab ?? "info"}>
        <TabsList>
          <TabsTrigger value="info">基本資料</TabsTrigger>
          <TabsTrigger value="contract">合約</TabsTrigger>
          <TabsTrigger value="grooming">美容紀錄</TabsTrigger>
          <TabsTrigger value="boarding">住宿紀錄</TabsTrigger>
          <TabsTrigger value="appointments">預約</TabsTrigger>
          <TabsTrigger value="monthly-plans">包月方案</TabsTrigger>
        </TabsList>

        {/* Info */}
        <TabsContent value="info" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                <PetPhotoUpload petId={petId} photoUrl={pet.photoUrl ?? null} petName={pet.name} />
                <div>
                  <p className="text-sm font-medium text-gray-700">寵物照片</p>
                  <p className="text-xs text-gray-400 mt-0.5">點擊圓形頭貼可上傳或更換照片</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: "物種", value: pet.species },
                { label: "品種", value: pet.breed ?? "未填寫" },
                { label: "性別", value: genderLabel(pet.gender) },
                { label: "生日", value: formatDate(pet.birthday) },
                { label: "年齡", value: calcAge(pet.birthday) },
                { label: "晶片號碼", value: pet.chipNumber ?? "未填寫" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {(pet.diseases || pet.allergies || pet.notes) && (
            <Card>
              <CardContent className="p-5 space-y-3">
                {pet.diseases && (
                  <div>
                    <p className="text-xs text-gray-500">特殊疾病</p>
                    <p className="text-sm text-gray-900 mt-0.5">{pet.diseases}</p>
                  </div>
                )}
                {pet.allergies && (
                  <div>
                    <p className="text-xs text-gray-500">過敏紀錄</p>
                    <p className="text-sm text-red-700 bg-red-50 rounded-lg p-2 mt-0.5">
                      ⚠️ {pet.allergies}
                    </p>
                  </div>
                )}
                {pet.notes && (
                  <div>
                    <p className="text-xs text-gray-500">備註</p>
                    <p className="text-sm text-gray-900 mt-0.5">{pet.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <VaccineManager petId={petId} initialRecords={vaccineRecords} />

          {services.length > 0 && (
            <PetServicePricing
              petId={petId}
              services={services}
              initialPrices={petPrices}
            />
          )}
        </TabsContent>

        {/* Contract */}
        <TabsContent value="contract" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">定型化契約</CardTitle>
              {pet.contract && pet.contract.status === "SIGNED" && (
                <div className="flex items-center gap-2">
                  <a
                    href={`/contract/${pet.contract.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    查看已簽合約
                  </a>
                  <ContractPDFDownload
                    data={{
                      shopName,
                      petName: pet.name,
                      species: pet.species,
                      breed: pet.breed ?? null,
                      customerName: pet.customer.name,
                      contractContent: pet.contract.content,
                      signedAt: pet.contract.signedAt?.toISOString() ?? null,
                      signerName: pet.contract.signerName ?? null,
                      signatureUrl: pet.contract.signatureUrl ?? null,
                    }}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              <ContractActions
                petId={petId}
                contract={pet.contract ? {
                  id: pet.contract.id,
                  status: pet.contract.status,
                  token: pet.contract.token,
                  signedAt: pet.contract.signedAt?.toISOString() ?? null,
                  signerName: pet.contract.signerName ?? null,
                } : null}
                baseUrl={baseUrl}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Grooming */}
        <TabsContent value="grooming" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">美容完工紀錄</h2>
            <Link href={`/customers/${customerId}/pets/${petId}/grooming/new`}>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                新增美容紀錄
              </Button>
            </Link>
          </div>

          {pet.groomingRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-12 text-gray-400">
              <Scissors className="h-10 w-10 mb-2" />
              <p className="text-sm">尚無美容紀錄</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pet.groomingRecords.map((record) => {
                const recordServices = (() => { try { return JSON.parse(record.services) as { name: string; price: number }[] } catch { return [] } })()
                const recordDate = record.date instanceof Date ? record.date.toISOString().split("T")[0] : String(record.date).split("T")[0]
                return (
                  <Card key={record.id}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {formatDate(record.date)}
                          </p>
                          <p className="text-sm text-gray-500 mt-0.5">
                            美容師：{record.groomer?.name ?? "未指定"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900">
                            {formatCurrency(record.totalCost)}
                          </p>
                          <div className="flex flex-col items-end gap-1 mt-1">
                            <a
                              href={`/grooming/${record.viewToken}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              完工報告連結
                            </a>
                            <GroomingShareButton
                              viewToken={record.viewToken}
                              petName={pet.name}
                              baseUrl={baseUrl}
                            />
                            {record.customerConfirmedAt && (
                              <span className="text-xs font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                客人已簽收
                              </span>
                            )}
                            {/* P3-4: 查看簽名 */}
                            {record.customerSignature && (
                              <a
                                href={`/grooming/${record.viewToken}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-purple-600 hover:underline flex items-center gap-1"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                查看簽名
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {recordServices.map((svc, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs text-purple-700"
                          >
                            {svc.name}
                          </span>
                        ))}
                      </div>

                      {(record.skinCondition || record.furCondition || record.notes) && (
                        <div className="mt-3 space-y-1 text-sm text-gray-600">
                          {record.skinCondition && <p>皮膚：{record.skinCondition}</p>}
                          {record.furCondition && <p>毛況：{record.furCondition}</p>}
                          {record.notes && <p>備註：{record.notes}</p>}
                        </div>
                      )}

                      {/* P2-5: 編輯/刪除按鈕 */}
                      <GroomingRecordActions
                        record={{
                          id: record.id,
                          date: recordDate,
                          groomerId: record.groomerId,
                          groomerName: record.groomer?.name ?? null,
                          services: recordServices,
                          products: record.products,
                          totalCost: record.totalCost,
                          skinCondition: record.skinCondition,
                          furCondition: record.furCondition,
                          notes: record.notes,
                        }}
                        staffList={staffList}
                        hasSignature={!!record.customerSignature}
                      />
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Boarding */}
        <TabsContent value="boarding" className="mt-4">
          {pet.boardingRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-12 text-gray-400">
              <Home className="h-10 w-10 mb-2" />
              <p className="text-sm">尚無住宿紀錄</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pet.boardingRecords.map((record) => {
                const bStatus = boardingStatusLabel(record.status)
                return (
                  <Card key={record.id}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${bStatus.color}`}>
                              {bStatus.label}
                            </span>
                            <span className="text-sm font-medium text-gray-700">
                              {record.room?.name ?? "未分配"}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            入住：{formatDate(record.checkIn)}
                            {record.checkOut && ` · 退房：${formatDate(record.checkOut)}`}
                          </p>
                          {record.notes && (
                            <p className="text-sm text-gray-500 mt-0.5">備註：{record.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">{formatCurrency(record.dailyRate)}/天</p>
                          {record.totalCost && (
                            <p className="font-bold text-gray-900">{formatCurrency(record.totalCost)}</p>
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

        {/* Monthly Plans */}
        <TabsContent value="monthly-plans" className="mt-4">
          <PetMonthlyPlanManager
            petId={petId}
            plans={pet.petMonthlyPlans.map((p) => ({
              ...p,
              startDate: p.startDate.toISOString(),
              endDate: p.endDate.toISOString(),
            }))}
          />
        </TabsContent>

        {/* Appointments */}
        <TabsContent value="appointments" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">預約記錄</h2>
            <Link href={`/appointments/new?petId=${petId}`}>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                新增預約
              </Button>
            </Link>
          </div>
          {pet.appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-12 text-gray-400">
              <Calendar className="h-10 w-10 mb-2" />
              <p className="text-sm">尚無預約紀錄</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pet.appointments.map((apt) => {
                const aStatus = appointmentStatusLabel(apt.status)
                const services = apt.services
                  ? (() => { try { return JSON.parse(apt.services) as { name: string }[] } catch { return [] } })()
                  : []
                return (
                  <Card key={apt.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${aStatus.color}`}>
                            {aStatus.label}
                          </span>
                          <span className="text-sm text-gray-700">
                            {formatDateTime(apt.scheduledAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {services.length > 0
                            ? services.map((s) => s.name).join("、")
                            : apt.type === "GROOMING" ? "美容" : "住宿"}
                          {apt.staff && ` · ${apt.staff.name}`}
                        </p>
                      </div>
                      {apt.estimatedCost && (
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(apt.estimatedCost)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

