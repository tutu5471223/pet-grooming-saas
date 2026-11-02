// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { hasPermission } from "@/lib/permissions"
import { sumNetRevenue } from "@/lib/revenue"
import { startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from "date-fns"

export async function GET() {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId, role, permissions } = guard.ctx
  // R6-H9: 營收只給 OWNER / reports 權限者（對齊 /api/reports 的 PERM-2）。
  const canSeeRevenue = hasPermission(role, permissions, "reports")

  const today = new Date()
  const todayStart = startOfDay(today)
  const todayEnd = endOfDay(today)
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  try {
  const [
    todayAppointments,
    stayingPets,
    monthRevenue,
    totalCustomers,
    monthlyRevenue,
    appointmentsByStatus,
  ] = await Promise.all([
    // 今日預約
    prisma.appointment.findMany({
      where: {
        shopId,
        scheduledAt: { gte: todayStart, lte: todayEnd },
      },
      include: {
        pet: { include: { customer: true } },
        staff: true,
      },
      orderBy: { scheduledAt: "asc" },
    }),

    // 住宿中的寵物
    prisma.boardingRecord.findMany({
      where: { shopId, status: "STAYING" },
      include: {
        pet: { include: { customer: true } },
        room: true,
      },
      orderBy: { checkIn: "asc" },
    }),

    // 本月收入（淨額口徑，M1）
    // Net revenue = sum(amount) - sum(refundedAmount) over the *original* charges
    // (status PAID or REFUNDED, amount >= 0). The negative reversal rows that the
    // refund flow creates (PAID, amount = -amount) are excluded via amount >= 0,
    // so a refund is counted exactly once (via refundedAmount), never twice.
    //   sell 100, refund 100  -> 100 - 100 = 0
    //   sell 100, refund 30   -> 100 - 30  = 70
    //   no refund             -> 100 - 0   = 100
    canSeeRevenue ? sumNetRevenue(shopId, monthStart, monthEnd) : null,

    // 總客人數
    prisma.customer.count({ where: { shopId } }),

    // 過去6個月收入（圖表用）
    canSeeRevenue
      ? Promise.all(
          Array.from({ length: 6 }, (_, i) => {
            const d = subMonths(today, 5 - i)
            return sumNetRevenue(shopId, startOfMonth(d), endOfMonth(d)).then((r) => ({
              month: `${d.getMonth() + 1}月`,
              revenue: r.net,
            }))
          })
        )
      : null,

    // 各狀態預約數
    prisma.appointment.groupBy({
      by: ["status"],
      where: { shopId, scheduledAt: { gte: monthStart, lte: monthEnd } },
      _count: true,
    }),
  ])

  return NextResponse.json({
    todayAppointments,
    stayingPets,
    monthRevenue: monthRevenue?.net ?? null,
    totalCustomers,
    monthlyRevenue,
    appointmentsByStatus,
  })
  } catch (error) {
    console.error("GET /api/dashboard", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
