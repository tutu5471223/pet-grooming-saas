import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { enforceRateLimit, clientIp } from "@/lib/rate-limit"

const MAX_SERVICE_IDS = 50

// Public endpoint: look up pet-specific pricing by phone + petName.
// Returns an empty array for any miss (no confirm/deny of customer existence).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params

  const limited =
    enforceRateLimit(`pet-pricing:${clientIp(req)}`, 20, 60_000) ??
    enforceRateLimit(`pet-pricing:shop:${shopId}`, 120, 60_000)
  if (limited) return limited

  const url = new URL(req.url)
  const phone = (url.searchParams.get("phone") ?? "").trim()
  const petName = (url.searchParams.get("petName") ?? "").trim()
  const serviceIds = (url.searchParams.get("serviceIds") ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, MAX_SERVICE_IDS)

  if (!phone || !petName || serviceIds.length === 0) {
    return NextResponse.json([])
  }
  if (phone.length > 30 || petName.length > 200) {
    return NextResponse.json([])
  }

  try {
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true } })
    if (!shop) return NextResponse.json([])

    const customer = await prisma.customer.findFirst({
      where: { phone, shopId },
      select: { id: true },
    })
    if (!customer) return NextResponse.json([])

    const pet = await prisma.pet.findFirst({
      where: { customerId: customer.id, name: petName, shopId, isActive: true },
      select: { id: true },
    })
    if (!pet) return NextResponse.json([])

    const prices = await prisma.petServicePrice.findMany({
      where: { petId: pet.id, shopId, serviceId: { in: serviceIds } },
      select: { serviceId: true, price: true },
    })
    return NextResponse.json(prices)
  } catch (error) {
    console.error("GET /api/booking/[shopId]/pet-pricing", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
