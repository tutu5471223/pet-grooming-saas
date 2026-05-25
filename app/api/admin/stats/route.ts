import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns"

export async function GET() {
  const session = await auth()
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const months = Array.from({ length: 6 }, (_, i) => subMonths(now, 5 - i))

  try {
  // Platform-level counts
  const [totalShops, newShopsThisMonth, totalCustomers, totalAppointments, activeSubs, trialSubs, monthlyGrowth, planStats] = await Promise.all([
    prisma.shop.count(),
    prisma.shop.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.customer.count(),
    prisma.appointment.count(),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "TRIAL" } }),
    Promise.all(
      months.map(async (m) => ({
        month: format(m, "M月"),
        shops: await prisma.shop.count({
          where: { createdAt: { gte: startOfMonth(m), lte: endOfMonth(m) } },
        }),
      }))
    ),
    prisma.subscription.groupBy({ by: ["status"], _count: true }),
  ])

  // Per-shop usage — fetch all shops with their subscription + counts
  const allShops = await prisma.shop.findMany({
    where: { id: { not: "system" } },
    include: {
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: {
        select: { customers: true, appointments: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // For each shop: new appointments this month, pets count, photo count
  const shopUsage = await Promise.all(
    allShops.map(async (shop) => {
      const [monthlyAppointments, petCount, photoCount] = await Promise.all([
        prisma.appointment.count({
          where: { shopId: shop.id, createdAt: { gte: monthStart, lte: monthEnd } },
        }),
        prisma.pet.count({ where: { shopId: shop.id, isActive: true } }),
        prisma.groomingRecord.count({
          where: {
            shopId: shop.id,
            OR: [
              { beforePhotoUrl: { not: null } },
              { afterPhotoUrl: { not: null } },
            ],
          },
        }),
      ])

      const sub = shop.subscriptions[0] ?? null
      return {
        id: shop.id,
        name: shop.name,
        customerCount: shop._count.customers,
        maxCustomers: sub?.plan.maxCustomers ?? 50,
        petCount,
        totalAppointments: shop._count.appointments,
        monthlyAppointments,
        photoCount,
        subStatus: sub?.status ?? null,
        subPlanName: sub?.plan.name ?? null,
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      }
    })
  )

  return NextResponse.json({
    totalShops,
    newShopsThisMonth,
    totalCustomers,
    totalAppointments,
    activeSubs,
    trialSubs,
    monthlyGrowth,
    planStats,
    shopUsage,
  })
  } catch (error) {
    console.error("GET /api/admin/stats", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
