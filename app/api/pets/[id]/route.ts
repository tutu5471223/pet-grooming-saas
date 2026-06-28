// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { readJson, z, shortText } from "@/lib/validation"

const updatePetSchema = z.object({
  photoUrl: z.string().nullish(),
  name: shortText.min(1).optional(),
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
  consentPhoto: z.boolean().optional(),
  consentSnack: z.boolean().optional(),
  snackAllergy: shortText.nullish(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId

  try {
    const pet = await prisma.pet.findFirst({
      where: { id, shopId },
      include: {
        customer: true,
        contract: true,
        groomingRecords: {
          include: { groomer: true, payment: true },
          orderBy: { date: "desc" },
        },
        boardingRecords: {
          include: { room: true, payment: true },
          orderBy: { checkIn: "desc" },
        },
        appointments: {
          include: { staff: true },
          orderBy: { scheduledAt: "desc" },
          take: 10,
        },
      },
    })

    if (!pet) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json(pet)
  } catch (error) {
    console.error("GET /api/pets/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId

  const parsed = await readJson(req, updatePetSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const data: Record<string, unknown> = {}
  if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl ?? null
  if (body.name !== undefined) data.name = body.name
  if (body.species !== undefined) data.species = body.species
  if (body.breed !== undefined) data.breed = body.breed || null
  if (body.gender !== undefined) data.gender = body.gender
  if (body.birthday !== undefined) data.birthday = body.birthday ? new Date(body.birthday) : null
  if (body.chipNumber !== undefined) data.chipNumber = body.chipNumber || null
  if (body.vaccineRecords !== undefined) data.vaccineRecords = body.vaccineRecords ? JSON.stringify(body.vaccineRecords) : null
  if (body.notes !== undefined) data.notes = body.notes || null
  if (body.personality !== undefined) data.personality = body.personality ?? []
  if (body.boneIssue !== undefined) data.boneIssue = body.boneIssue
  if (body.boneNote !== undefined) data.boneNote = body.boneNote || null
  if (body.skinIssue !== undefined) data.skinIssue = body.skinIssue
  if (body.skinNote !== undefined) data.skinNote = body.skinNote || null
  if (body.earIssue !== undefined) data.earIssue = body.earIssue
  if (body.earNote !== undefined) data.earNote = body.earNote || null
  if (body.eyeIssue !== undefined) data.eyeIssue = body.eyeIssue
  if (body.eyeNote !== undefined) data.eyeNote = body.eyeNote || null
  if (body.heartDisease !== undefined) data.heartDisease = body.heartDisease
  if (body.boneDisease !== undefined) data.boneDisease = body.boneDisease
  if (body.skinDisease !== undefined) data.skinDisease = body.skinDisease
  if (body.epilepsy !== undefined) data.epilepsy = body.epilepsy
  if (body.diabetes !== undefined) data.diabetes = body.diabetes
  if (body.surgeryHistory !== undefined) data.surgeryHistory = body.surgeryHistory
  if (body.surgeryNote !== undefined) data.surgeryNote = body.surgeryNote || null
  if (body.otherDisease !== undefined) data.otherDisease = body.otherDisease || null
  if (body.bathFrequency !== undefined) data.bathFrequency = body.bathFrequency || null
  if (body.groomFrequency !== undefined) data.groomFrequency = body.groomFrequency || null
  if (body.blowDryerFear !== undefined) data.blowDryerFear = body.blowDryerFear || null
  if (body.afterGroomHandle !== undefined) data.afterGroomHandle = body.afterGroomHandle || null
  if (body.consentPhoto !== undefined) data.consentPhoto = body.consentPhoto
  if (body.consentSnack !== undefined) data.consentSnack = body.consentSnack
  if (body.snackAllergy !== undefined) data.snackAllergy = body.snackAllergy || null

  try {
    const pet = await prisma.pet.updateMany({
      where: { id, shopId },
      data,
    })

    return NextResponse.json(pet)
  } catch (error) {
    console.error("PATCH /api/pets/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId

  try {
    await prisma.pet.updateMany({
      where: { id, shopId },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/pets/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
