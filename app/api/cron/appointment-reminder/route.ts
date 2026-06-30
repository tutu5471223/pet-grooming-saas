// NOTE: this route duplicates app/api/cron/reminder — schedule only ONE of the
// two. Both now share the Appointment.reminderSentAt idempotency flag, so even
// if both are accidentally scheduled, a given appointment is reminded at most
// once (filtered on read + conditional updateMany on success).
import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { sendLineMessage, applyReminderTemplate } from "@/lib/line"

const DEFAULT_TEMPLATE = `您好，{name}！\n提醒您明天 {date} {time} 有一個寵物美容預約。\n如需更改請提前告知，謝謝！`

/**
 * TEN-5: CRON_SECRET is MANDATORY (fail-CLOSED). The secret is accepted ONLY via
 * the `Authorization: Bearer <secret>` header (no ?secret= query param), and is
 * compared in constant time. Returns a NextResponse to short-circuit on failure,
 * or null when authorized.
 */
function authorizeCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error("[CRON] CRON_SECRET 未設定，拒絕執行")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const authHeader = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

// Compute Taiwan tomorrow date range in UTC for DB query
function getTomorrowTaipeiRangeUTC(): { start: Date; end: Date } {
  const taipeiNow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date())
  const [year, month, day] = taipeiNow.split("-").map(Number)
  // BUGFIX: roll over month/year via a real Date instead of string-concatenating
  // `day + 1` (which produced e.g. "06-31" = Invalid Date at month end).
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1))
  const ty = tomorrow.getUTCFullYear()
  const tm = String(tomorrow.getUTCMonth() + 1).padStart(2, "0")
  const td = String(tomorrow.getUTCDate()).padStart(2, "0")
  const start = new Date(`${ty}-${tm}-${td}T00:00:00+08:00`)
  const end = new Date(`${ty}-${tm}-${td}T23:59:59+08:00`)
  return { start, end }
}

export async function GET(req: NextRequest) {
  const denied = authorizeCron(req)
  if (denied) return denied

  const { start, end } = getTomorrowTaipeiRangeUTC()
  console.log(`[CRON] 發送預約提醒：${start.toISOString()} ~ ${end.toISOString()}`)

  // Find all confirmed/pending appointments for tomorrow with customers who have lineUserId
  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: start, lte: end },
      status: { in: ["CONFIRMED", "PENDING"] },
      // M9: skip appointments already reminded (shared idempotency flag).
      reminderSentAt: null,
    },
    include: {
      pet: { include: { customer: true } },
      shop: { select: { name: true, phone: true, reminderTemplate: true, lineChannelToken: true } },
    },
  })

  console.log(`[CRON] 找到 ${appointments.length} 筆需提醒的預約`)

  let sent = 0
  let failed = 0

  for (const appt of appointments) {
    const customer = appt.pet.customer
    if (!customer.lineUserId) continue

    const scheduledAt = appt.scheduledAt
    const twDate = new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }).format(scheduledAt)
    const twTime = new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).format(scheduledAt)

    let services = ""
    try {
      const svcs = JSON.parse(appt.services ?? "[]") as { name: string }[]
      services = svcs.map((s) => s.name).join("、") || "美容服務"
    } catch { services = "美容服務" }

    const template = appt.shop.reminderTemplate ?? DEFAULT_TEMPLATE
    const message = applyReminderTemplate(template, {
      name: customer.name,
      phone: customer.phone,
      date: twDate,
      time: twTime,
      services,
    })

    const ok = await sendLineMessage(customer.lineUserId, message, appt.shop.lineChannelToken)
    if (ok) {
      // M9: mark reminded only on success; conditional updateMany stays idempotent.
      await prisma.appointment.updateMany({
        where: { id: appt.id, reminderSentAt: null },
        data: { reminderSentAt: new Date() },
      })
      sent++
    } else failed++
  }

  console.log(`[CRON] 提醒發送完成：成功 ${sent}，失敗 ${failed}`)
  return NextResponse.json({ ok: true, total: appointments.length, sent, failed })
}
