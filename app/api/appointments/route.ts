// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, addMinutes } from "date-fns"
import { writeAudit } from "@/lib/audit"
import { readJson, z, money } from "@/lib/validation"

// Non-strict: validate known fields' types/bounds; tolerate extra keys.
const createSchema = z.object({
  petId: z.string().min(1),
  staffId: z.string().min(1).optional().nullable(),
  type: z.string().max(50).optional(),
  scheduledAt: z.string().min(1),
  duration: z.number().int().positive().max(24 * 60).optional().nullable(),
  status: z.string().max(50).optional(),
  services: z.any().optional(),
  estimatedCost: money.optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  source: z.string().max(50).optional(),
  boardingCheckOut: z.string().optional().nullable(),
  boardingRoomId: z.string().min(1).optional().nullable(),
  petMonthlyPlanId: z.string().min(1).optional().nullable(),
})

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

  const parsed = await readJson(req, createSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const scheduledAt = new Date(body.scheduledAt)
    if (isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "預約時間格式錯誤" }, { status: 400 })
    }
    const duration = body.duration || 60

    // TEN-2: verify the pet belongs to this shop (blocks cross-tenant pet injection + PII read-back)
    const pet = await prisma.pet.findFirst({
      where: { id: body.petId, shopId, isActive: true },
      select: { id: true },
    })
    if (!pet) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // TEN-3: verify any client-supplied foreign ids belong to this shop before persisting.
    if (body.staffId) {
      const staff = await prisma.user.findFirst({
        where: { id: body.staffId, shopId },
        select: { id: true },
      })
      if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (body.boardingRoomId) {
      const boardingRoom = await prisma.boardingRoom.findFirst({
        where: { id: body.boardingRoomId, shopId },
        select: { id: true },
      })
      if (!boardingRoom) return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (body.petMonthlyPlanId) {
      const plan = await prisma.petMonthlyPlan.findFirst({
        where: { id: body.petMonthlyPlanId, shopId },
        select: { id: true },
      })
      if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

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
