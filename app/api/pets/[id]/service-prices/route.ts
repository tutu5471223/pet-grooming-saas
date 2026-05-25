import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopId = session.user.shopId
  const { id: petId } = await params

  try {
    const pet = await prisma.pet.findFirst({ where: { id: petId, shopId } })
    if (!pet) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const prices = await prisma.petServicePrice.findMany({
      where: { petId, shopId },
      select: { serviceId: true, price: true },
    })
    return NextResponse.json(prices)
  } catch (error) {
    console.error("GET /api/pets/[id]/service-prices", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopId = session.user.shopId
  const { id: petId } = await params

  try {
    const pet = await prisma.pet.findFirst({ where: { id: petId, shopId } })
    if (!pet) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = (await req.json()) as { serviceId: string; price: number | null }[]
    const toSave = body.filter((r) => r.price !== null && r.price !== undefined && r.price >= 0)

    await prisma.$transaction(async (tx) => {
      await tx.petServicePrice.deleteMany({ where: { petId, shopId } })
      if (toSave.length > 0) {
        await tx.petServicePrice.createMany({
          data: toSave.map(({ serviceId, price }) => ({ shopId, petId, serviceId, price: price as number })),
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("PUT /api/pets/[id]/service-prices", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
