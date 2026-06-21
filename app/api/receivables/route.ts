// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { requireAuth, requireRole } from "@/lib/auth-guard"
import { readJson, positiveMoney, shortText, longText, z } from "@/lib/validation"
import { round2 } from "@/lib/money"

export async function GET(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { searchParams } = new URL(req.url)
  const requestedStatus = searchParams.get("status") ?? "PENDING"
  // Whitelist status filter to avoid arbitrary value injection into the query.
  const status = ["PENDING", "PAID", "REFUNDED"].includes(requestedStatus)
    ? requestedStatus
    : "PENDING"

  try {
    const payments = await prisma.payment.findMany({
      where: { shopId, status },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        groomingRecord: { select: { date: true, services: true } },
        boardingRecord: { select: { checkIn: true, checkOut: true } },
      },
      orderBy: { paidAt: "desc" },
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error("GET /api/receivables", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

const createSchema = z.object({
  customerId: shortText.min(1),
  amount: positiveMoney,
  notes: longText.nullable().optional(),
})

export async function POST(req: NextRequest) {
  // Creating a receivable is a financial action: OWNER only.
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  const parsed = await readJson(req, createSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const amount = round2(body.amount)

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, shopId },
    })
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const payment = await prisma.payment.create({
      data: {
        shopId,
        customerId: body.customerId,
        amount,
        billingType: "SINGLE",
        status: "PENDING",
        notes: body.notes || null,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
    })

    await writeAudit({
      shopId,
      userId,
      action: "CREATE_RECEIVABLE",
      resource: "Payment",
      resourceId: payment.id,
      detail: { customerId: body.customerId, amount },
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error("POST /api/receivables", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
