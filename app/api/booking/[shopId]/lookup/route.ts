import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params
  const phone = req.nextUrl.searchParams.get("phone")
  if (!phone) return NextResponse.json({ error: "Missing phone" }, { status: 400 })

  const customer = await prisma.customer.findFirst({
    where: { shopId, phone },
    include: {
      pets: {
        where: { isActive: true },
        select: { id: true, name: true, species: true },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!customer) {
    return NextResponse.json({ found: false })
  }

  return NextResponse.json({
    found: true,
    customerName: customer.name,
    pets: customer.pets,
  })
}
