// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { nanoid } from "nanoid"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const body = await req.json()

  try {
    // SECURITY: Verify customer belongs to this shop before creating pet.
    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, shopId },
    })
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    // Fetch shop template once before transaction
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { contractTemplate: true },
    })

    // Atomic: pet creation + contract creation in one transaction.
    // If contract creation fails, pet is rolled back too.
    const pet = await prisma.$transaction(async (tx) => {
      const newPet = await tx.pet.create({
        data: {
          name: body.name,
          species: body.species || "犬",
          breed: body.breed || null,
          gender: body.gender || "UNKNOWN",
          birthday: body.birthday ? new Date(body.birthday) : null,
          chipNumber: body.chipNumber || null,
          vaccineRecords: body.vaccineRecords ? JSON.stringify(body.vaccineRecords) : null,
          diseases: body.diseases || null,
          allergies: body.allergies || null,
          notes: body.notes || null,
          customerId: body.customerId,
          shopId,
        },
      })

      await tx.contract.create({
        data: {
          petId: newPet.id,
          shopId,
          content: shop?.contractTemplate ?? "",
          status: "PENDING",
          token: nanoid(32),
          expiresAt: null,
        },
      })

      return newPet
    })

    return NextResponse.json(pet, { status: 201 })
  } catch (error) {
    console.error("POST /api/pets", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
