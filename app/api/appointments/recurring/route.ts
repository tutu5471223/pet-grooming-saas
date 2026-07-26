// SECURITY: 多店家隔離 — pet/staff 均驗證屬於本店
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { addDays, addMonths } from "date-fns"
import { writeAudit } from "@/lib/audit"
import { readJson, z } from "@/lib/validation"

// 固定週期預約：依間隔天數，自開始日時起自動建立未來一個月內的多筆預約。
const recurringSchema = z.object({
  petId: z.string().min(1),
  staffId: z.string().min(1).optional().nullable(),
  startAt: z.string().min(1),
  // 店家自訂間隔天數（例如 7 / 10 / 14）
  intervalDays: z.number().int().min(1).max(90),
  type: z.string().max(50).optional(),
  duration: z.number().int().positive().max(24 * 60).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

export async function POST(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  const parsed = await readJson(req, recurringSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const start = new Date(body.startAt)
    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: "開始時間格式錯誤" }, { status: 400 })
    }

    // TEN: 驗證寵物屬於本店
    const pet = await prisma.pet.findFirst({
      where: { id: body.petId, shopId, isActive: true },
      select: { id: true },
    })
    if (!pet) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // TEN: 驗證美容師屬於本店
    if (body.staffId) {
      const staff = await prisma.user.findFirst({
        where: { id: body.staffId, shopId },
        select: { id: true },
      })
      if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // 產生日期：自開始日時起，每 intervalDays 一筆，直到滿一個月為止。
    const end = addMonths(start, 1)
    const dates: Date[] = []
    for (let d = start; d <= end; d = addDays(d, body.intervalDays)) {
      dates.push(new Date(d))
      // 安全上限，避免異常間隔造成大量寫入
      if (dates.length >= 60) break
    }
    if (dates.length === 0) {
      return NextResponse.json({ error: "無法產生任何預約日期" }, { status: 400 })
    }

    const result = await prisma.appointment.createMany({
      // status 固定為 PENDING、reminderSentAt 預設為 null，因此這些預約會與一般
      // 預約一樣被前一天的 LINE 提醒 cron 涵蓋（app/api/cron/reminder 與
      // app/api/cron/appointment-reminder 都是查 status ∈ [CONFIRMED, PENDING]
      // 且 reminderSentAt = null，並未依 source 過濾）。改動請保持此不變式。
      data: dates.map((scheduledAt) => ({
        petId: body.petId,
        shopId,
        staffId: body.staffId || null,
        type: body.type || "GROOMING",
        scheduledAt,
        duration: body.duration || null,
        status: "PENDING",
        source: "RECURRING",
        notes: body.notes || null,
      })),
    })

    await writeAudit({
      shopId,
      userId,
      action: "CREATE_RECURRING_APPOINTMENTS",
      resource: "Appointment",
      resourceId: body.petId,
      detail: { count: result.count, intervalDays: body.intervalDays, startAt: body.startAt },
    })

    return NextResponse.json(
      { count: result.count, dates: dates.map((d) => d.toISOString()) },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/appointments/recurring", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
