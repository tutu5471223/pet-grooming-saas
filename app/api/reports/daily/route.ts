// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { startOfDay, endOfDay, parseISO } from "date-fns"

export async function GET(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const dateStr = new URL(req.url).searchParams.get("date")
  const date = dateStr ? parseISO(dateStr) : new Date()
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "date 參數格式錯誤" }, { status: 400 })
  }
  const start = startOfDay(date)
  const end = endOfDay(date)

  const [payments, storedValueTopups] = await Promise.all([
    prisma.payment.findMany({
      where: {
        shopId,
        paidAt: { gte: start, lte: end },
        amount: { gt: 0 },
      },
      include: {
        customer: { select: { name: true } },
        groomingRecord: {
          select: {
            date: true,
            services: true,
            pet: { select: { name: true } },
          },
        },
        boardingRecord: {
          select: {
            checkIn: true,
            checkOut: true,
            pet: { select: { name: true } },
          },
        },
      },
      orderBy: { paidAt: "asc" },
    }),
    prisma.storedValueHistory.findMany({
      where: {
        shopId,
        amount: { gt: 0 },
        createdAt: { gte: start, lte: end },
      },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ])

  // Group by payment method
  const byMethod: Record<string, number> = {}
  for (const p of payments) {
    const key = p.paymentMethod ?? "—"
    byMethod[key] = (byMethod[key] ?? 0) + p.amount
  }

  const groomingPayments = payments.filter((p) => p.groomingRecordId)
  const boardingPayments = payments.filter((p) => p.boardingRecordId)
  const otherPayments = payments.filter((p) => !p.groomingRecordId && !p.boardingRecordId)
  const total = payments.reduce((s, p) => s + p.amount, 0)

  return NextResponse.json({
    date: start.toISOString(),
    total,
    byMethod,
    groomingPayments,
    boardingPayments,
    otherPayments,
    storedValueTopups,
  })
}
