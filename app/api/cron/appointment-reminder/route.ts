import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendLineMessage, applyReminderTemplate } from "@/lib/line"

const DEFAULT_TEMPLATE = `您好，{name}！\n提醒您明天 {date} {time} 有一個寵物美容預約。\n如需更改請提前告知，謝謝！`

// Compute Taiwan tomorrow date range in UTC for DB query
function getTomorrowTaipeiRangeUTC(): { start: Date; end: Date } {
  const taipeiNow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date())
  const [year, month, day] = taipeiNow.split("-").map(Number)
  // Taiwan tomorrow = UTC day before at 16:00 to next day at 16:00
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}T00:00:00+08:00`)
  const end = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}T23:59:59+08:00`)
  return { start, end }
}

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET to prevent unauthorized triggers
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const querySecret = new URL(req.url).searchParams.get("secret")

  if (secret && authHeader !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { start, end } = getTomorrowTaipeiRangeUTC()
  console.log(`[CRON] 發送預約提醒：${start.toISOString()} ~ ${end.toISOString()}`)

  // Find all confirmed/pending appointments for tomorrow with customers who have lineUserId
  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: start, lte: end },
      status: { in: ["CONFIRMED", "PENDING"] },
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
    if (ok) sent++
    else failed++
  }

  console.log(`[CRON] 提醒發送完成：成功 ${sent}，失敗 ${failed}`)
  return NextResponse.json({ ok: true, total: appointments.length, sent, failed })
}
