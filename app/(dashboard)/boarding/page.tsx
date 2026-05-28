import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatDate, formatCurrency, boardingStatusLabel } from "@/lib/utils"
import { differenceInDays, startOfWeek, addDays, startOfDay } from "date-fns"
import { Home, Plus, CalendarClock, LayoutGrid, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BoardingCheckout } from "@/components/boarding/boarding-checkout"
import { BoardingCancel } from "@/components/boarding/boarding-cancel"
import { BoardingDetailSheet } from "@/components/boarding/boarding-detail-sheet"
import { NewBoardingDialog } from "@/components/boarding/new-boarding-dialog"
import { BoardingApptCheckin } from "@/components/boarding/boarding-appt-checkin"
import { BoardingFilter } from "@/components/boarding/boarding-filter"
import { BoardingWeekView, type WeekRecord } from "@/components/boarding/boarding-week-view"
import { DeleteRoomButton } from "@/components/boarding/delete-room-button"
import Link from "next/link"

async function getBoardingData(shopId: string) {
  const [rooms, staying, recent, upcoming] = await Promise.all([
    prisma.boardingRoom.findMany({
      where: { shopId },
      include: {
        boardingRecords: {
          where: { status: "STAYING" },
          include: { pet: { include: { customer: true } } },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.boardingRecord.findMany({
      where: { shopId, status: "STAYING" },
      include: { pet: { include: { customer: true } }, room: true },
      orderBy: { checkIn: "asc" },
    }),
    prisma.boardingRecord.findMany({
      where: { shopId, status: "CHECKED_OUT" },
      include: { pet: { include: { customer: true } }, room: true },
      orderBy: { checkOut: "desc" },
      take: 10,
    }),
    prisma.appointment.findMany({
      where: { shopId, type: "BOARDING", status: "CONFIRMED" },
      include: {
        pet: { include: { customer: true } },
        boardingRoom: true,
      },
      orderBy: { scheduledAt: "asc" },
    }),
  ])
  return { rooms, staying, recent, upcoming }
}

async function getFilteredRecords(
  shopId: string,
  { q, from, to }: { q: string; from: string; to: string }
) {
  const fromDate = from ? startOfDay(new Date(from)) : undefined
  const toDate = to ? new Date(to + "T23:59:59") : undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const andConditions: any[] = []

  // Proper overlap: checkIn <= toDate AND (checkOut IS NULL OR checkOut >= fromDate)
  if (toDate) {
    andConditions.push({ checkIn: { lte: toDate } })
  }
  if (fromDate) {
    andConditions.push({
      OR: [
        { checkOut: null },
        { checkOut: { gte: fromDate } },
      ],
    })
  }

  if (q) {
    andConditions.push({
      OR: [
        { pet: { name: { contains: q } } },
        { pet: { customer: { name: { contains: q } } } },
      ],
    })
  }

  return prisma.boardingRecord.findMany({
    where: {
      shopId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    },
    include: { pet: { include: { customer: true } }, room: true },
    orderBy: { checkIn: "desc" },
    take: 100,
  })
}

async function getWeekViewRecords(shopId: string): Promise<WeekRecord[]> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 21)

  const records = await prisma.boardingRecord.findMany({
    where: {
      shopId,
      status: { not: "CANCELLED" },
      checkIn: { lte: weekEnd },
      OR: [{ checkOut: null }, { checkOut: { gte: weekStart } }],
    },
    include: { pet: { include: { customer: true } } },
  })

  return records.map((r) => ({
    id: r.id,
    petName: r.pet.name,
    petBreed: r.pet.breed ?? r.pet.species,
    petNotes: r.pet.notes ?? null,
    customerName: r.pet.customer.name,
    customerPhone: r.pet.customer.phone,
    roomId: r.roomId,
    checkIn: r.checkIn.toISOString(),
    checkOut: r.checkOut?.toISOString() ?? null,
    status: r.status,
    dailyRate: r.dailyRate,
    notes: r.notes,
  }))
}

const ROOM_STATUS_STYLE: Record<string, string> = {
  AVAILABLE: "border-green-200 bg-green-50",
  OCCUPIED: "border-orange-200 bg-orange-50",
  MAINTENANCE: "border-red-200 bg-red-50",
}

const ROOM_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "空房",
  OCCUPIED: "使用中",
  MAINTENANCE: "維修中",
}

export default async function BoardingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; view?: string }>
}) {
  const session = await auth()
  const shopId = session!.user.shopId
  const { q = "", from = "", to = "", view = "list" } = await searchParams

  const { rooms, staying, recent, upcoming } = await getBoardingData(shopId)

  const hasFilter = !!(q || from || to)
  const isWeekView = view === "week"

  const [filteredRecords, weekRecords] = await Promise.all([
    hasFilter ? getFilteredRecords(shopId, { q, from, to }) : Promise.resolve([]),
    isWeekView ? getWeekViewRecords(shopId) : Promise.resolve([]),
  ])

  const weekRooms = rooms.map((r) => ({ id: r.id, name: r.name, type: r.type ?? null }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">住宿管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            {staying.length} 隻寵物住宿中・{rooms.filter((r) => r.status === "AVAILABLE").length} 間空房
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <Link
              href="/boarding"
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                !isWeekView
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              管理
            </Link>
            <Link
              href="/boarding?view=week"
              className={`flex items-center gap-1.5 px-3 py-1.5 border-l border-gray-200 transition-colors ${
                isWeekView
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              週視圖
            </Link>
          </div>
          <NewBoardingDialog shopId={shopId} rooms={rooms} />
        </div>
      </div>

      {isWeekView ? (
        /* ── Week view ── */
        <div className="space-y-3">
          <p className="text-sm text-gray-500">顯示本週起3週內的住宿安排</p>
          <BoardingWeekView rooms={weekRooms} records={weekRecords} />
        </div>
      ) : (
        /* ── List / management view ── */
        <>
          {/* P3-2: Search filter */}
          <div className="space-y-4">
            <BoardingFilter defaultQ={q} defaultFrom={from} defaultTo={to} />

            {/* Search results */}
            {hasFilter && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    搜尋結果（{filteredRecords.length} 筆）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredRecords.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">查無符合條件的住宿紀錄</p>
                  ) : (
                    <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                      <thead className="border-b border-gray-100">
                        <tr>
                          <th className="pb-2 text-left font-medium text-gray-500 whitespace-nowrap">寵物/客人</th>
                          <th className="pb-2 text-left font-medium text-gray-500 whitespace-nowrap">房間</th>
                          <th className="pb-2 text-left font-medium text-gray-500 whitespace-nowrap">入住</th>
                          <th className="pb-2 text-left font-medium text-gray-500 whitespace-nowrap">退房</th>
                          <th className="pb-2 text-left font-medium text-gray-500">狀態</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredRecords.map((r) => {
                          const { label, color } = boardingStatusLabel(r.status)
                          return (
                            <tr key={r.id}>
                              <td className="py-2.5">
                                <p className="font-medium text-gray-900">{r.pet.name}</p>
                                <p className="text-xs text-gray-500">{r.pet.customer.name}</p>
                              </td>
                              <td className="py-2.5 text-gray-700">{r.room?.name ?? "—"}</td>
                              <td className="py-2.5 text-gray-700">{formatDate(r.checkIn)}</td>
                              <td className="py-2.5 text-gray-700">
                                {r.checkOut ? formatDate(r.checkOut) : "—"}
                              </td>
                              <td className="py-2.5">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
                                  {label}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Room grid */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">房間狀態總覽</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {rooms.map((room) => {
                const occupant = room.boardingRecords[0]
                return (
                  <div
                    key={room.id}
                    className={`rounded-xl border-2 p-3 ${ROOM_STATUS_STYLE[room.status]}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{room.name}</p>
                        {room.type && (
                          <p className="text-xs text-gray-500">{room.type}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-600">
                        {ROOM_STATUS_LABEL[room.status]}
                      </span>
                    </div>
                    {occupant && (
                      <div className="mt-2 text-xs text-gray-700">
                        <p className="font-medium">{occupant.pet.name}</p>
                        <p className="text-gray-500">{occupant.pet.customer.name}</p>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-500">{formatCurrency(room.dailyRate)}/天</p>
                    {room.status === "AVAILABLE" && (
                      <DeleteRoomButton roomId={room.id} roomName={room.name} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Upcoming boarding reservations */}
          {upcoming.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-blue-500" />
                  即將入住 ({upcoming.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcoming.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-100 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-xl">
                          🐾
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {appt.pet.name}
                            <span className="ml-2 text-sm font-normal text-gray-500">
                              ({appt.pet.customer.name})
                            </span>
                          </p>
                          <p className="text-xs text-gray-600">
                            {appt.boardingRoom?.name ?? "未選房間"} ·
                            入住 {formatDate(appt.scheduledAt)}
                            {appt.boardingCheckOut && ` · 退房 ${formatDate(appt.boardingCheckOut)}`}
                            {appt.estimatedCost && ` · 預估 ${formatCurrency(appt.estimatedCost)}`}
                          </p>
                          {appt.notes && (
                            <p className="text-xs text-gray-500 mt-0.5">{appt.notes}</p>
                          )}
                        </div>
                      </div>
                      <BoardingApptCheckin appointmentId={appt.id} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Staying pets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">住宿中寵物 ({staying.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {staying.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Home className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">目前無住宿寵物</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {staying.map((record) => {
                    const days = Math.max(1, differenceInDays(new Date(), record.checkIn))
                    const accruedCost = days * record.dailyRate
                    return (
                      <div
                        key={record.id}
                        className="flex items-center justify-between rounded-xl bg-orange-50 border border-orange-100 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-xl">
                            🐾
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {record.pet.name}
                              <span className="ml-2 text-sm font-normal text-gray-500">
                                ({record.pet.customer.name})
                              </span>
                            </p>
                            <p className="text-xs text-gray-600">
                              {record.room?.name ?? "未分配"} ·
                              入住 {formatDate(record.checkIn)} ·
                              第 {days} 天 · {formatCurrency(accruedCost)}
                            </p>
                            {record.notes && (
                              <p className="text-xs text-gray-500 mt-0.5">{record.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <BoardingDetailSheet
                            recordId={record.id}
                            petName={record.pet.name}
                            breed={record.pet.breed ?? null}
                            species={record.pet.species}
                            customerName={record.pet.customer.name}
                            roomName={record.room?.name ?? "未分配"}
                            checkIn={record.checkIn}
                            dailyRate={record.dailyRate}
                          />
                          <BoardingCheckout
                            recordId={record.id}
                            dailyRate={record.dailyRate}
                            checkIn={record.checkIn}
                            addOnServices={record.addOnServices}
                            priceAdjustment={record.priceAdjustment}
                            priceAdjustmentNote={record.priceAdjustmentNote}
                          />
                          <BoardingCancel recordId={record.id} petName={record.pet.name} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent checkouts */}
          {recent.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">近期退房紀錄</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100">
                    <tr>
                      <th className="pb-2 text-left font-medium text-gray-500">寵物/客人</th>
                      <th className="pb-2 text-left font-medium text-gray-500 whitespace-nowrap">房間</th>
                      <th className="pb-2 text-left font-medium text-gray-500 whitespace-nowrap">入住</th>
                      <th className="pb-2 text-left font-medium text-gray-500 whitespace-nowrap">退房</th>
                      <th className="pb-2 text-right font-medium text-gray-500 whitespace-nowrap">費用</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recent.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5">
                          <p className="font-medium text-gray-900">{r.pet.name}</p>
                          <p className="text-xs text-gray-500">{r.pet.customer.name}</p>
                        </td>
                        <td className="py-2.5 text-gray-700 whitespace-nowrap">{r.room?.name ?? "—"}</td>
                        <td className="py-2.5 text-gray-700 whitespace-nowrap">{formatDate(r.checkIn)}</td>
                        <td className="py-2.5 text-gray-700 whitespace-nowrap">{formatDate(r.checkOut)}</td>
                        <td className="py-2.5 text-right font-medium text-gray-900 whitespace-nowrap">
                          {r.totalCost ? formatCurrency(r.totalCost) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
