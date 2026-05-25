// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  try {
    const payments = await prisma.payment.findMany({
      where: { shopId, ...(status ? { status } : {}) },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        groomingRecord: { select: { date: true } },
        boardingRecord: { select: { checkIn: true } },
      },
      orderBy: { paidAt: "desc" },
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error("GET /api/payments", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
