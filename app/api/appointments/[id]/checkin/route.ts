// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { differenceInDays } from "date-fns"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId

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

  const checkIn = appointment.scheduledAt
  const checkOut = appointment.boardingCheckOut
  const days = checkOut
    ? Math.max(1, differenceInDays(checkOut, checkIn))
    : 1

  try {
    const result = await prisma.$transaction(async (tx) => {
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
    console.error("PATCH /api/appointments/[id]/checkin", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
