// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { startOfMonth, endOfMonth } from "date-fns"

export async function GET() {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  try {
    const sub = await prisma.subscription.findFirst({
      where: { shopId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    })

    const [customerCount, staffCount, monthlyAppointmentCount] = await Promise.all([
      prisma.customer.count({ where: { shopId, status: "ACTIVE" } }),
      prisma.user.count({ where: { shopId, isActive: true } }),
      prisma.appointment.count({
        where: { shopId, createdAt: { gte: monthStart, lte: monthEnd } },
      }),
    ])

    return NextResponse.json({ subscription: sub, customerCount, staffCount, monthlyAppointmentCount })
  } catch (error) {
    console.error("GET /api/subscription", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
