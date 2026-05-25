// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") ?? "PENDING"

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

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const shopId = session.user.shopId
  const body = await req.json()

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, shopId },
    })
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const payment = await prisma.payment.create({
      data: {
        shopId,
        customerId: body.customerId,
        amount: Number(body.amount),
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
      userId: session.user.id,
      action: "CREATE_RECEIVABLE",
      resource: "Payment",
      resourceId: payment.id,
      detail: { customerId: body.customerId, amount: body.amount },
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error("POST /api/receivables", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
