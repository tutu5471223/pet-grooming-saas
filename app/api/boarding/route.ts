// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

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

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const body = await req.json()

  try {
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
        checkIn: new Date(body.checkIn),
        checkOut: body.checkOut ? new Date(body.checkOut) : null,
        dailyRate: body.dailyRate,
        notes: body.notes || null,
        status: "STAYING",
        priceAdjustment: body.priceAdjustment ?? null,
        priceAdjustmentNote: body.priceAdjustmentNote || null,
        addOnServices: body.addOnServices ? JSON.stringify(body.addOnServices) : null,
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
