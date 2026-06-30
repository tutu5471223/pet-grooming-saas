// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { nanoid } from "nanoid"
import { requireAuth } from "@/lib/auth-guard"
import { readJson, z, shortText } from "@/lib/validation"
import { sanitizeContractHtml } from "@/lib/sanitize"
import { checkPetLimit } from "@/lib/subscription-guard"

const createPetSchema = z.object({
  customerId: z.string().min(1),
  name: shortText.min(1),
  species: shortText.optional(),
  breed: shortText.nullish(),
  gender: shortText.optional(),
  birthday: z.string().optional().nullable(),
  chipNumber: shortText.nullish(),
  vaccineRecords: z.unknown().optional(),
  notes: shortText.nullish(),
  // 個性標籤
  personality: z.array(z.string()).optional(),
  // 身體狀況
  boneIssue: z.boolean().optional(),
  boneNote: shortText.nullish(),
  skinIssue: z.boolean().optional(),
  skinNote: shortText.nullish(),
  earIssue: z.boolean().optional(),
  earNote: shortText.nullish(),
  eyeIssue: z.boolean().optional(),
  eyeNote: shortText.nullish(),
  // 病史分類
  heartDisease: z.boolean().optional(),
  boneDisease: z.boolean().optional(),
  skinDisease: z.boolean().optional(),
  epilepsy: z.boolean().optional(),
  diabetes: z.boolean().optional(),
  surgeryHistory: z.boolean().optional(),
  surgeryNote: shortText.nullish(),
  otherDisease: shortText.nullish(),
  // 美容習慣
  bathFrequency: shortText.nullish(),
  groomFrequency: shortText.nullish(),
  blowDryerFear: shortText.nullish(),
  // 同意事項
  afterGroomHandle: shortText.nullish(),
  consentPhotoRecord: z.boolean().optional(),
  consentPhotoSocial: z.boolean().optional(),
  consentSnack: z.boolean().optional(),
  snackAllergy: shortText.nullish(),
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

    // M6: enforce plan pet limit (and subscription expiry) before creating a pet.
    const limitCheck = await checkPetLimit(shopId)
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.message }, { status: 403 })
    }

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
          notes: body.notes || null,
          personality: body.personality ?? [],
          boneIssue: body.boneIssue ?? false,
          boneNote: body.boneNote || null,
          skinIssue: body.skinIssue ?? false,
          skinNote: body.skinNote || null,
          earIssue: body.earIssue ?? false,
          earNote: body.earNote || null,
          eyeIssue: body.eyeIssue ?? false,
          eyeNote: body.eyeNote || null,
          heartDisease: body.heartDisease ?? false,
          boneDisease: body.boneDisease ?? false,
          skinDisease: body.skinDisease ?? false,
          epilepsy: body.epilepsy ?? false,
          diabetes: body.diabetes ?? false,
          surgeryHistory: body.surgeryHistory ?? false,
          surgeryNote: body.surgeryNote || null,
          otherDisease: body.otherDisease || null,
          bathFrequency: body.bathFrequency || null,
          groomFrequency: body.groomFrequency || null,
          blowDryerFear: body.blowDryerFear || null,
          afterGroomHandle: body.afterGroomHandle || null,
          consentPhotoRecord: body.consentPhotoRecord ?? false,
          consentPhotoSocial: body.consentPhotoSocial ?? false,
          consentSnack: body.consentSnack ?? false,
          snackAllergy: body.snackAllergy || null,
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
