import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enforceRateLimit, clientIp } from "@/lib/rate-limit"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params

  const limited =
    enforceRateLimit(`booking-info:${clientIp(req)}`, 60, 60_000) ??
    enforceRateLimit(`booking-info:shop:${shopId}`, 300, 60_000)
  if (limited) return limited

  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, phone: true, address: true },
    })
    if (!shop) return NextResponse.json({ error: "找不到店家" }, { status: 404 })

    const services = await prisma.service.findMany({
      where: { shopId, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, price: true, duration: true, category: true },
    })

    return NextResponse.json({ shop, services })
  } catch (error) {
    console.error("GET /api/booking/[shopId]/info", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
