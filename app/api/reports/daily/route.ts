// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { round2 } from "@/lib/money"
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
    // M1: include the negative reversal rows (do NOT filter amount > 0) so the
    // day's total reflects refunds. status is gated to PAID/REFUNDED to keep
    // PENDING out (those have paidAt = null and are already excluded anyway).
    prisma.payment.findMany({
      where: {
        shopId,
        status: { in: ["PAID", "REFUNDED"] },
        paidAt: { gte: start, lte: end },
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
    // M1: "充值" = genuine top-ups only. A CREDIT refund writes a *positive*
    // storedValueHistory row whose reason starts with "退款" (see refund route).
    // Excluding that prefix stops refund credit-backs being miscounted as the
    // day's stored-value top-ups.
    prisma.storedValueHistory.findMany({
      where: {
        shopId,
        amount: { gt: 0 },
        createdAt: { gte: start, lte: end },
        NOT: { reason: { startsWith: "退款" } },
      },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ])

  // Real charges (incl. fully-refunded originals) vs. the negative reversal rows
  // produced by refunds processed today.
  const sales = payments.filter((p) => p.amount >= 0)
  const refunds = payments.filter((p) => p.amount < 0)

  // Group by payment method — net (reversal rows carry the original's method).
  const byMethod: Record<string, number> = {}
  for (const p of payments) {
    const key = p.paymentMethod ?? "—"
    byMethod[key] = round2((byMethod[key] ?? 0) + p.amount)
  }

  const groomingPayments = sales.filter((p) => p.groomingRecordId)
  const boardingPayments = sales.filter((p) => p.boardingRecordId)
  const otherPayments = sales.filter((p) => !p.groomingRecordId && !p.boardingRecordId)

  const grossTotal = round2(sales.reduce((s, p) => s + p.amount, 0))
  const refundTotal = round2(refunds.reduce((s, p) => s - p.amount, 0)) // positive number
  const total = round2(grossTotal - refundTotal) // net = sum of every row

  return NextResponse.json({
    date: start.toISOString(),
    total, // M1: now NET of refunds (was gross)
    grossTotal,
    refundTotal,
    byMethod,
    groomingPayments,
    boardingPayments,
    otherPayments,
    refunds,
    storedValueTopups,
  })
}
