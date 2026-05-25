import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx
  const { id } = await params

  try {
    const sale = await prisma.sale.findFirst({
      where: { id, shopId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          include: { product: { select: { id: true, name: true, unit: true, category: true } } },
        },
      },
    })
    if (!sale) return NextResponse.json({ error: "找不到銷售紀錄" }, { status: 404 })
    return NextResponse.json(sale)
  } catch (err) {
    console.error("GET /api/sales/[id] error:", err)
    return NextResponse.json({ error: "載入失敗，請重試" }, { status: 500 })
  }
}
