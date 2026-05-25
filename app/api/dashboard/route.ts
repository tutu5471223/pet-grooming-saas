// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from "date-fns"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
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

    // 本月收入
    prisma.payment.aggregate({
      where: {
        shopId,
        status: "PAID",
        paidAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
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
            where: { shopId, status: "PAID", paidAt: { gte: s, lte: e } },
            _sum: { amount: true },
          })
          .then((r) => ({
            month: `${d.getMonth() + 1}月`,
            revenue: r._sum.amount ?? 0,
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
    monthRevenue: monthRevenue._sum.amount ?? 0,
    totalCustomers,
    monthlyRevenue,
    appointmentsByStatus,
  })
  } catch (error) {
    console.error("GET /api/dashboard", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
