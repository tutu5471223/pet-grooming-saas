// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, addMinutes } from "date-fns"
import { writeAudit } from "@/lib/audit"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date")
  const status = searchParams.get("status")
  const week = searchParams.get("week")

  try {
    const where: any = { shopId }
    if (date) {
      const d = new Date(date)
      where.scheduledAt = { gte: startOfDay(d), lte: endOfDay(d) }
    } else if (week) {
      const weekStart = startOfDay(new Date(week))
      const weekEnd = endOfDay(addMinutes(weekStart, 7 * 24 * 60 - 1))
      where.scheduledAt = { gte: weekStart, lte: weekEnd }
    }
    if (status) where.status = status

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        pet: { include: { customer: true } },
        staff: true,
      },
      orderBy: { scheduledAt: "asc" },
    })

    return NextResponse.json(appointments)
  } catch (error) {
    console.error("GET /api/appointments", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const body = await req.json()

  try {
    const scheduledAt = new Date(body.scheduledAt)
    const duration = body.duration || 60

    if (body.staffId) {
      const apptEnd = addMinutes(scheduledAt, duration)

      const conflicts = await prisma.appointment.findMany({
        where: {
          shopId,
          staffId: body.staffId,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
        select: {
          id: true,
          scheduledAt: true,
          duration: true,
          pet: { select: { name: true } },
        },
      })

      const newStart = scheduledAt.getTime()
      const newEnd = apptEnd.getTime()

      const overlapping = conflicts.find((c) => {
        const cStart = new Date(c.scheduledAt).getTime()
        const cEnd = cStart + (c.duration ?? 60) * 60000
        return newStart < cEnd && newEnd > cStart
      })

      if (overlapping) {
        return NextResponse.json(
          {
            error: "時段衝突",
            conflict: {
              petName: overlapping.pet.name,
              scheduledAt: overlapping.scheduledAt,
              duration: overlapping.duration,
            },
          },
          { status: 409 }
        )
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        petId: body.petId,
        shopId,
        staffId: body.staffId || null,
        type: body.type || "GROOMING",
        scheduledAt,
        duration: body.duration || null,
        status: body.type === "BOARDING" ? "CONFIRMED" : (body.status || "PENDING"),
        services: body.services ? JSON.stringify(body.services) : null,
        estimatedCost: body.estimatedCost || null,
        notes: body.notes || null,
        source: body.source || "WALK_IN",
        boardingCheckOut: body.boardingCheckOut ? new Date(body.boardingCheckOut) : null,
        boardingRoomId: body.boardingRoomId || null,
        petMonthlyPlanId: body.petMonthlyPlanId || null,
      },
    })

    await writeAudit({
      shopId,
      userId: session.user.id,
      action: "CREATE_APPOINTMENT",
      resource: "Appointment",
      resourceId: appointment.id,
      detail: { type: appointment.type, scheduledAt: appointment.scheduledAt },
    })

    return NextResponse.json(appointment, { status: 201 })
  } catch (error) {
    console.error("POST /api/appointments", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
