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

    const ROOM_OCCUPIED = "ROOM_OCCUPIED"
    let record
    try {
      // M7: do the oversell guard, the record create, and the room-occupy flag
      // in one transaction so a STAYING record and the OCCUPIED flag stay in sync.
      record = await prisma.$transaction(async (tx) => {
        if (body.roomId) {
          // A room may hold at most one STAYING record. An existing STAYING
          // record (or an already-OCCUPIED room) means the room is taken.
          const conflict = await tx.boardingRecord.findFirst({
            where: { roomId: body.roomId, shopId, status: "STAYING" },
          })
          if (conflict) throw new Error(ROOM_OCCUPIED)
          const room = await tx.boardingRoom.findFirst({
            where: { id: body.roomId, shopId },
            select: { status: true },
          })
          if (room?.status === "OCCUPIED") throw new Error(ROOM_OCCUPIED)
        }

        const rec = await tx.boardingRecord.create({
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

        // SECURITY: shopId-scoped updateMany prevents cross-shop room tampering
        // if somehow an invalid roomId slipped through.
        if (body.roomId) {
          await tx.boardingRoom.updateMany({
            where: { id: body.roomId, shopId },
            data: { status: "OCCUPIED" },
          })
        }

        return rec
      })
    } catch (e) {
      if (e instanceof Error && e.message === ROOM_OCCUPIED) {
        return NextResponse.json(
          { error: "此房間目前已有住宿中的寵物，無法重複入住" },
          { status: 409 }
        )
      }
      throw e
    }

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error("POST /api/boarding", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
