// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { round2 } from "@/lib/money"
import { startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from "date-fns"

export async function GET() {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

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
    prisma.payment.aggregate({
      where: {
        shopId,
        status: { in: ["PAID", "REFUNDED"] },
        amount: { gte: 0 },
        paidAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true, refundedAmount: true },
    }),

    // 總客人數
    prisma.customer.count({ where: { shopId } }),

    // 過去6個月收入（圖表用）
    Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(today, 5 - i)
        const s = startOfMonth(d)
        const e = endOfMonth(d)
        return prisma.payment
          .aggregate({
            where: {
              shopId,
              status: { in: ["PAID", "REFUNDED"] },
              amount: { gte: 0 },
              paidAt: { gte: s, lte: e },
            },
            _sum: { amount: true, refundedAmount: true },
          })
          .then((r) => ({
            month: `${d.getMonth() + 1}月`,
            // Net of refunds (M1)
            revenue: round2((r._sum.amount ?? 0) - (r._sum.refundedAmount ?? 0)),
          }))
      })
    ),

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
    monthRevenue: round2((monthRevenue._sum.amount ?? 0) - (monthRevenue._sum.refundedAmount ?? 0)),
    totalCustomers,
    monthlyRevenue,
    appointmentsByStatus,
  })
  } catch (error) {
    console.error("GET /api/dashboard", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
