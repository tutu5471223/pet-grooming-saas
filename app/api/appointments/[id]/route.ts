// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { sendLineMessage } from "@/lib/line"
import { readJson, z, money } from "@/lib/validation"
import { round2 } from "@/lib/money"

// M8: known appointment status values (mirrors the UI STATUS_OPTIONS).
const VALID_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]

// M8: legal status-transition whitelist. COMPLETED is terminal — once an
// appointment reaches COMPLETED it can never leave, which is what makes the
// monthly-plan deduction below idempotent (it can never be re-entered, so the
// session is consumed exactly once). CANCELLED / NO_SHOW may be re-opened.
const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: ["PENDING", "CONFIRMED"],
  NO_SHOW: ["PENDING", "CONFIRMED"],
}

// Non-strict: validate known fields' types/bounds; tolerate extra keys.
const patchSchema = z.object({
  status: z.string().max(50).optional(),
  staffId: z.string().min(1).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  services: z.any().optional(),
  estimatedCost: money.optional().nullable(),
  duration: z.number().int().positive().max(24 * 60).optional().nullable(),
  petMonthlyPlanId: z.string().min(1).optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { id } = await params

  const parsed = await readJson(req, patchSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const existing = await prisma.appointment.findFirst({ where: { id, shopId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // TEN-3: verify any client-supplied foreign ids belong to this shop before persisting.
    if (body.staffId) {
      const staff = await prisma.user.findFirst({
        where: { id: body.staffId, shopId },
        select: { id: true },
      })
      if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (body.petMonthlyPlanId) {
      const plan = await prisma.petMonthlyPlan.findFirst({
        where: { id: body.petMonthlyPlanId, shopId },
        select: { id: true },
      })
      if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (body.scheduledAt && isNaN(new Date(body.scheduledAt).getTime())) {
      return NextResponse.json({ error: "預約時間格式錯誤" }, { status: 400 })
    }

    // M8: reject illegal status transitions. Same-status PATCH and PATCHes that
    // don't touch status (e.g. editing notes) are always allowed.
    if (body.status !== undefined && body.status !== existing.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "無效的預約狀態" }, { status: 400 })
      }
      const allowed = STATUS_TRANSITIONS[existing.status] ?? []
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `不允許的狀態轉移：${existing.status} → ${body.status}` },
          { status: 400 }
        )
      }
    }

    // M8: deduction happens only on the FIRST entry into COMPLETED. Because
    // COMPLETED is a terminal state (see STATUS_TRANSITIONS), it can never be
    // re-entered, so the session is consumed exactly once per appointment.
    const enteringCompleted = body.status === "COMPLETED" && existing.status !== "COMPLETED"

    await prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({
        where: { id, shopId },
        data: {
          ...(body.status !== undefined && { status: body.status }),
          ...(body.staffId !== undefined && { staffId: body.staffId ?? null }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.scheduledAt && { scheduledAt: new Date(body.scheduledAt) }),
          ...(body.services !== undefined && { services: body.services !== null ? JSON.stringify(body.services) : null }),
          ...(body.estimatedCost !== undefined && { estimatedCost: body.estimatedCost ?? null }),
          ...(body.duration !== undefined && { duration: body.duration ?? null }),
          ...(body.petMonthlyPlanId !== undefined && { petMonthlyPlanId: body.petMonthlyPlanId ?? null }),
        },
      })

      // 首次進入 COMPLETED 的結算。COMPLETED 是終態（見 STATUS_TRANSITIONS），
      // 只會發生一次；而「開始美容」路徑是由 grooming POST 直接把預約標 COMPLETED
      // （不經此 endpoint），因此兩條路徑互斥、不會重複建立應收。
      if (enteringCompleted) {
        if (existing.petMonthlyPlanId) {
          // 包月：扣一次（atomic + capped），已預付故不另計現金應收。
          const plan = await tx.petMonthlyPlan.findFirst({
            where: { id: existing.petMonthlyPlanId, shopId },
            select: { maxSessions: true },
          })
          if (plan) {
            await tx.petMonthlyPlan.updateMany({
              where: { id: existing.petMonthlyPlanId, shopId, usedSessions: { lt: plan.maxSessions } },
              data: { usedSessions: { increment: 1 } },
            })
          }
        } else {
          // 非包月：依「本次或先前已修改」的預估金額建立一筆 PENDING 應收，
          // 否則直接「標記完成」不會產生任何應收帳款（就是這次的 bug）。
          const finalCost = round2(
            body.estimatedCost !== undefined ? (body.estimatedCost ?? 0) : (existing.estimatedCost ?? 0)
          )
          if (finalCost > 0) {
            const pet = await tx.pet.findFirst({
              where: { id: existing.petId, shopId },
              select: { customerId: true },
            })
            if (pet) {
              await tx.payment.create({
                data: {
                  shopId,
                  customerId: pet.customerId,
                  petId: existing.petId,
                  amount: finalCost,
                  status: "PENDING",
                  billingType: "SINGLE",
                  notes: "預約完成應收",
                },
              })
            }
          }
        }
      }
    })

    const updated = await prisma.appointment.findFirst({
      where: { id, shopId },
      include: {
        pet: { include: { customer: true, contract: true } },
        staff: true,
        shop: { select: { name: true, phone: true, lineChannelToken: true } },
      },
    })

    // Auto LINE notification on first CONFIRMED
    console.log(`[APPT] id=${id} body.status=${body.status ?? "none"} existing.status=${existing.status}`)

    if (body.status === "CONFIRMED" && existing.status !== "CONFIRMED") {
      const lineUserId = updated?.pet.customer.lineUserId ?? null
      const legacyLineId = updated?.pet.customer.lineId ?? null
      console.log(`[APPT] CONFIRMED: lineUserId=${lineUserId} lineId(display)=${legacyLineId}`)

      const targetUserId = lineUserId  // only send to bound LINE User ID
      if (!targetUserId) {
        console.log(`[APPT] 客人尚未綁定 LINE，略過推播 (lineId display-only: ${legacyLineId ?? "null"})`)
      } else {
        const isValidFormat = /^U[0-9a-fA-F]{32}$/.test(targetUserId)
        if (!isValidFormat) {
          console.warn(`[APPT] lineUserId "${targetUserId}" 格式不符 (應為 U + 32 hex)，嘗試推播但可能失敗`)
        }

        const scheduledAt = updated!.scheduledAt
        const twTime = new Intl.DateTimeFormat("zh-TW", {
          timeZone: "Asia/Taipei",
          month: "numeric",
          day: "numeric",
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          hourCycle: "h23",
        }).format(scheduledAt)

        let svcLine = ""
        try {
          const svcs = JSON.parse(updated!.services ?? "[]") as { name: string }[]
          svcLine = svcs.map((s) => s.name).join("、")
        } catch { /* ignore */ }

        const lines = [
          `【${updated!.shop.name}】您好，您的預約已確認！`,
          `📅 時間：${twTime}`,
          `🐾 寵物：${updated!.pet.name}`,
        ]
        if (svcLine) lines.push(`✂️ 服務：${svcLine}`)
        if (updated!.shop.phone) lines.push(`📞 如需更改請來電：${updated!.shop.phone}`)
        else lines.push("如需更改請提前告知，謝謝！")

        console.log(`[APPT] 發送 LINE 推播 → ${targetUserId}`)
        const ok = await sendLineMessage(targetUserId, lines.join("\n"), updated!.shop.lineChannelToken)
        console.log(`[APPT] LINE 推播結果: ${ok ? "成功 ✅" : "失敗 ❌"}`)
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/appointments/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { id } = await params

  try {
    await prisma.appointment.deleteMany({ where: { id, shopId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/appointments/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
