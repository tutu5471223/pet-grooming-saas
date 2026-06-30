// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { differenceInDays } from "date-fns"

// M7: sentinel used to surface a room-occupancy conflict from inside the
// transaction as a 409 (rather than a generic 500).
class RoomOccupiedError extends Error {}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { id } = await params

  const appointment = await prisma.appointment.findFirst({
    where: { id, shopId, type: "BOARDING", status: "CONFIRMED" },
  })
  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!appointment.boardingRoomId) {
    return NextResponse.json({ error: "未選擇房間" }, { status: 400 })
  }

  // Verify room belongs to shop
  const room = await prisma.boardingRoom.findFirst({
    where: { id: appointment.boardingRoomId, shopId },
  })
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 })

  // M7: early reject if the room is already flagged occupied. The authoritative
  // race-safe check is re-run inside the transaction below.
  if (room.status === "OCCUPIED") {
    return NextResponse.json({ error: "此房間已有寵物入住" }, { status: 409 })
  }

  const checkIn = appointment.scheduledAt
  const checkOut = appointment.boardingCheckOut
  const days = checkOut
    ? Math.max(1, differenceInDays(checkOut, checkIn))
    : 1

  try {
    const result = await prisma.$transaction(async (tx) => {
      // M7: race-safe guard — block if another active stay already holds this room.
      const occupied = await tx.boardingRecord.findFirst({
        where: { roomId: appointment.boardingRoomId!, shopId, status: "STAYING" },
        select: { id: true },
      })
      if (occupied) throw new RoomOccupiedError()

      const record = await tx.boardingRecord.create({
        data: {
          petId: appointment.petId,
          shopId,
          roomId: appointment.boardingRoomId,
          checkIn,
          checkOut: checkOut ?? null,
          dailyRate: room.dailyRate,
          totalCost: days * room.dailyRate,
          notes: appointment.notes ?? null,
          status: "STAYING",
        },
      })

      await tx.boardingRoom.update({
        where: { id: appointment.boardingRoomId! },
        data: { status: "OCCUPIED" },
      })

      await tx.appointment.update({
        where: { id },
        data: { status: "COMPLETED" },
      })

      return record
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof RoomOccupiedError) {
      return NextResponse.json({ error: "此房間已有寵物入住" }, { status: 409 })
    }
    console.error("PATCH /api/appointments/[id]/checkin", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
