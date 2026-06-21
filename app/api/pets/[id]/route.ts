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
  diseases: shortText.nullish(),
  allergies: shortText.nullish(),
  notes: shortText.nullish(),
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
  if (body.diseases !== undefined) data.diseases = body.diseases || null
  if (body.allergies !== undefined) data.allergies = body.allergies || null
  if (body.notes !== undefined) data.notes = body.notes || null

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
