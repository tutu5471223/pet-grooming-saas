import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

// Public endpoint: look up pet-specific pricing by phone + petName
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params
  const url = new URL(req.url)
  const phone = url.searchParams.get("phone") ?? ""
  const petName = url.searchParams.get("petName") ?? ""
  const serviceIds = (url.searchParams.get("serviceIds") ?? "").split(",").filter(Boolean)

  if (!phone || !petName || serviceIds.length === 0) {
    return NextResponse.json([])
  }

  try {
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
