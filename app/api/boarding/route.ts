// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { readJson, money, shortText, longText, z } from "@/lib/validation"
import { round2 } from "@/lib/money"

export async function GET(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const status = new URL(req.url).searchParams.get("status")?.slice(0, 50) || null

  try {
    const records = await prisma.boardingRecord.findMany({
      where: { shopId, ...(status ? { status } : {}) },
      include: {
        pet: { include: { customer: true } },
        room: true,
      },
      orderBy: { checkIn: "desc" },
    })

    return NextResponse.json(records)
  } catch (error) {
    console.error("GET /api/boarding", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

const createSchema = z.object({
  petId: z.string().min(1),
  roomId: z.string().min(1).nullish(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1).nullish(),
  dailyRate: money,
  notes: longText.nullish(),
  priceAdjustment: z.number().finite().min(-1_000_000).max(1_000_000).nullish(),
  priceAdjustmentNote: shortText.nullish(),
  addOnServices: z
    .array(z.object({ name: shortText.optional(), price: money }).passthrough())
    .nullish(),
})

export async function POST(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    const parsed = await readJson(req, createSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data

    const checkInDate = new Date(body.checkIn)
    if (isNaN(checkInDate.getTime())) {
      return NextResponse.json({ error: "checkIn 日期格式錯誤" }, { status: 400 })
    }
    let checkOutDate: Date | null = null
    if (body.checkOut) {
      checkOutDate = new Date(body.checkOut)
      if (isNaN(checkOutDate.getTime())) {
        return NextResponse.json({ error: "checkOut 日期格式錯誤" }, { status: 400 })
      }
    }

    // SECURITY: Verify pet belongs to this shop.
    const pet = await prisma.pet.findFirst({
      where: { id: body.petId, shopId, isActive: true },
    })
    if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 })

    // SECURITY: Verify room belongs to this shop.
    if (body.roomId) {
      const room = await prisma.boardingRoom.findFirst({
        where: { id: body.roomId, shopId },
      })
      if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    const record = await prisma.boardingRecord.create({
      data: {
        petId: body.petId,
        shopId,
        roomId: body.roomId || null,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        dailyRate: round2(body.dailyRate),
        notes: body.notes || null,
        status: "STAYING",
        priceAdjustment: body.priceAdjustment != null ? round2(body.priceAdjustment) : null,
        priceAdjustmentNote: body.priceAdjustmentNote || null,
        addOnServices: body.addOnServices
          ? JSON.stringify(
              body.addOnServices.map((a) => ({ ...a, price: round2(a.price) }))
            )
          : null,
      },
    })

    // SECURITY: Update room status using shopId-scoped updateMany to prevent
    // cross-shop room status tampering if somehow an invalid roomId slipped through.
    if (body.roomId) {
      await prisma.boardingRoom.updateMany({
        where: { id: body.roomId, shopId },
        data: { status: "OCCUPIED" },
      })
    }

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error("POST /api/boarding", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
