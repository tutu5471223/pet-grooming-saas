// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { nanoid } from "nanoid"
import { requireAuth } from "@/lib/auth-guard"
import { readJson, z, shortText } from "@/lib/validation"
import { sanitizeContractHtml } from "@/lib/sanitize"

const createPetSchema = z.object({
  customerId: z.string().min(1),
  name: shortText.min(1),
  species: shortText.optional(),
  breed: shortText.nullish(),
  gender: shortText.optional(),
  birthday: z.string().optional().nullable(),
  chipNumber: shortText.nullish(),
  vaccineRecords: z.unknown().optional(),
  diseases: shortText.nullish(),
  allergies: shortText.nullish(),
  notes: shortText.nullish(),
})

export async function POST(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const parsed = await readJson(req, createPetSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

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
          // Sanitize shop-authored HTML before storing (defense vs stored XSS).
          content: sanitizeContractHtml(shop?.contractTemplate ?? ""),
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
