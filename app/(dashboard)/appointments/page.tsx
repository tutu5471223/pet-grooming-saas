import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { format, startOfDay, endOfDay, addDays, subDays, startOfWeek, addMinutes } from "date-fns"
import Link from "next/link"
import { Calendar, ChevronLeft, ChevronRight, Plus, Scissors, LayoutGrid, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, appointmentStatusLabel } from "@/lib/utils"
import { AppointmentActions } from "@/components/appointments/appointment-actions"
import { AppointmentEditDelete } from "@/components/appointments/appointment-edit-delete"
import { WeekCalendar } from "@/components/appointments/week-calendar"

async function getAppointmentsForDay(shopId: string, date: Date) {
  return prisma.appointment.findMany({
    where: {
      shopId,
      scheduledAt: { gte: startOfDay(date), lte: endOfDay(date) },
    },
    include: { pet: { include: { customer: true } }, staff: true },
    orderBy: { scheduledAt: "asc" },
  })
}

async function getAppointmentsForWeek(shopId: string, weekStart: Date) {
  const weekEnd = endOfDay(addDays(weekStart, 6))
  return prisma.appointment.findMany({
    where: {
      shopId,
      scheduledAt: { gte: startOfDay(weekStart), lte: weekEnd },
      status: { notIn: ["CANCELLED"] },
    },
    include: { pet: { include: { customer: true } }, staff: true },
    orderBy: { scheduledAt: "asc" },
  })
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-400",
  CONFIRMED: "bg-blue-400",
  IN_PROGRESS: "bg-purple-400",
  COMPLETED: "bg-green-400",
  CANCELLED: "bg-gray-300",
  NO_SHOW: "bg-red-400",
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>
}) {
  const session = await auth()
  const shopId = session!.user.shopId
  const { date: dateStr, view = "day" } = await searchParams
  const selectedDate = dateStr ? new Date(dateStr) : new Date()
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }) // Mon

  const isWeekView = view === "week"

  const [dayAppointments, weekAppointments, shop] = await Promise.all([
    !isWeekView ? getAppointmentsForDay(shopId, selectedDate) : Promise.resolve([]),
    isWeekView ? getAppointmentsForWeek(shopId, weekStart) : Promise.resolve([]),
    prisma.shop.findUnique({ where: { id: shopId }, select: { name: true, phone: true } }),
  ])

  const appointments = isWeekView ? weekAppointments : dayAppointments

  const prevDate = format(subDays(selectedDate, 1), "yyyy-MM-dd")
  const nextDate = format(addDays(selectedDate, 1), "yyyy-MM-dd")
  const prevWeek = format(subDays(weekStart, 7), "yyyy-MM-dd")
  const nextWeek = format(addDays(weekStart, 7), "yyyy-MM-dd")
  const todayStr = format(new Date(), "yyyy-MM-dd")

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">預約排程</h1>
          <p className="text-sm text-gray-500 mt-1">{appointments.length} 個預約</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <Link
              href={`/appointments?date=${format(selectedDate, "yyyy-MM-dd")}&view=day`}
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${
                !isWeekView ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <List className="h-4 w-4" /> 日視圖
            </Link>
            <Link
              href={`/appointments?date=${format(selectedDate, "yyyy-MM-dd")}&view=week`}
              className={`flex items-center gap-1.5 px-3 py-2 border-l border-gray-200 transition-colors ${
                isWeekView ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <LayoutGrid className="h-4 w-4" /> 週視圖
            </Link>
          </div>
          <Link href="/appointments/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              新增預約
            </Button>
          </Link>
        </div>
      </div>

      {/* Date navigator */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
        <Link href={`/appointments?date=${isWeekView ? prevWeek : prevDate}&view=${view}`}>
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="text-center">
          {isWeekView ? (
            <>
              <p className="font-bold text-lg text-gray-900">
                {format(weekStart, "MM/dd")} – {format(addDays(weekStart, 6), "MM/dd")}
              </p>
              <p className="text-sm text-gray-500">{format(weekStart, "yyyy年")} 第 {Math.ceil((weekStart.getDate() + startOfDay(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1)).getDay()) / 7)} 週</p>
            </>
          ) : (
            <>
              <p className="font-bold text-lg text-gray-900">
                {format(selectedDate, "yyyy年 MM月 dd日")}
              </p>
              <p className="text-sm text-gray-500">
                {["日", "一", "二", "三", "四", "五", "六"][selectedDate.getDay()]}曜日
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dateStr && dateStr !== todayStr && (
            <Link href={`/appointments?view=${view}`}>
              <Button variant="outline" size="sm">今天</Button>
            </Link>
          )}
          <Link href={`/appointments?date=${isWeekView ? nextWeek : nextDate}&view=${view}`}>
            <Button variant="ghost" size="icon">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Week view */}
      {isWeekView ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">週行事曆</CardTitle>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Calendar className="h-12 w-12 mb-3" />
                <p className="text-base font-medium">本週無預約</p>
              </div>
            ) : (
              <WeekCalendar
                appointments={appointments.map((a) => ({
                  ...a,
                  scheduledAt: a.scheduledAt.toISOString(),
                }))}
                weekStart={weekStart}
                shopName={shop?.name ?? session!.user.shopName}
                shopPhone={shop?.phone ?? null}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        /* Day view */
        appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 text-gray-400">
            <Calendar className="h-12 w-12 mb-3" />
            <p className="text-base font-medium">今日無預約</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt) => {
              const statusInfo = appointmentStatusLabel(apt.status)
              const services = apt.services
                ? (() => { try { return JSON.parse(apt.services) as { name: string }[] } catch { return [] } })()
                : []

              return (
                <Card key={apt.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Time */}
                      <div className="text-center shrink-0 w-16">
                        <div
                          className={`h-3 w-3 rounded-full mx-auto mb-1 ${STATUS_COLORS[apt.status] ?? "bg-gray-300"}`}
                        />
                        <p className="text-sm font-bold text-gray-900">
                          {new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei", hour12: false }).format(new Date(apt.scheduledAt))}
                        </p>
                        {apt.duration && (
                          <p className="text-xs text-gray-400">{apt.duration}分鐘</p>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/customers/${apt.pet.customer.id}/pets/${apt.pet.id}`}
                            className="font-semibold text-gray-900 hover:text-indigo-600 hover:underline"
                          >
                            {apt.pet.name}
                          </Link>
                          <span className="text-sm text-gray-500">
                            ({apt.pet.customer.name} · {apt.pet.customer.phone})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span
                            className={`text-xs font-medium rounded-full px-2 py-0.5 ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                          {services.length > 0 && (
                            <span className="text-sm text-gray-600">
                              {services.map((s) => s.name).join("、")}
                            </span>
                          )}
                          {apt.staff && (
                            <span className="text-sm text-gray-500">
                              美容師：{apt.staff.name}
                            </span>
                          )}
                        </div>

                        {apt.notes && (
                          <p className="mt-1 text-xs text-gray-500">{apt.notes}</p>
                        )}
                      </div>

                      {/* Cost + Actions */}
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        {apt.estimatedCost && (
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(apt.estimatedCost)}
                          </p>
                        )}
                        <AppointmentEditDelete
                          appointment={{
                            id: apt.id,
                            scheduledAt: apt.scheduledAt.toISOString(),
                            staffId: apt.staffId ?? null,
                            services: apt.services ?? null,
                            estimatedCost: apt.estimatedCost ?? null,
                            duration: apt.duration ?? null,
                            notes: apt.notes ?? null,
                            status: apt.status,
                          }}
                        />
                        <AppointmentActions
                          appointmentId={apt.id}
                          currentStatus={apt.status}
                          notifyInfo={{
                            petName: apt.pet.name,
                            customerName: apt.pet.customer.name,
                            scheduledAt: apt.scheduledAt.toISOString(),
                            services: apt.services,
                            estimatedCost: apt.estimatedCost,
                            shopName: shop?.name ?? session!.user.shopName,
                            shopPhone: shop?.phone ?? null,
                          }}
                        />
                        {apt.status === "CONFIRMED" && apt.type !== "BOARDING" && (
                          <Link
                            href={`/customers/${apt.pet.customer.id}/pets/${apt.pet.id}/grooming/new?appointmentId=${apt.id}&date=${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date(apt.scheduledAt))}&staffId=${apt.staffId ?? ""}&services=${encodeURIComponent(apt.services ?? "[]")}`}
                          >
                            <button className="mt-0.5 flex items-center gap-1 rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors">
                              <Scissors className="h-3 w-3" />
                              開始美容
                            </button>
                          </Link>
                        )}
                        {apt.status === "COMPLETED" && (
                          <Link href={`/customers/${apt.pet.customer.id}/pets/${apt.pet.id}?tab=grooming`}>
                            <button className="mt-0.5 flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors">
                              <Scissors className="h-3 w-3" />
                              查看美容紀錄
                            </button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
