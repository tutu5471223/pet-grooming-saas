import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { readJson, z } from "@/lib/validation"
import { parseMoney } from "@/lib/money"

const servicePricesSchema = z.array(
  z.object({
    serviceId: z.string().min(1),
    price: z.number().finite().nullable(),
  })
)

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

    const parsed = await readJson(req, servicePricesSchema)
    if (!parsed.ok) return parsed.response

    // Validate + normalise each money value server-side (finite/>=0/cap, round2).
    // A null price means "no custom price" → skip it.
    const toSave: { serviceId: string; price: number }[] = []
    for (const r of parsed.data) {
      if (r.price === null) continue
      const price = parseMoney(r.price, { allowZero: true })
      if (price === null) {
        return NextResponse.json({ error: "價格無效" }, { status: 400 })
      }
      toSave.push({ serviceId: r.serviceId, price })
    }

    await prisma.$transaction(async (tx) => {
      await tx.petServicePrice.deleteMany({ where: { petId, shopId } })
      if (toSave.length > 0) {
        await tx.petServicePrice.createMany({
          data: toSave.map(({ serviceId, price }) => ({ shopId, petId, serviceId, price })),
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("PUT /api/pets/[id]/service-prices", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
