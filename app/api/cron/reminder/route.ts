import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendLineMessage, applyReminderTemplate } from "@/lib/line"

const DEFAULT_TEMPLATE = `您好，{name}！\n提醒您明天 {date} {time} 有一個寵物美容預約。\n如需更改請提前告知，謝謝！`

function getTomorrowTaipeiRangeUTC(): { start: Date; end: Date } {
  const taipeiNow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date())
  const [year, month, day] = taipeiNow.split("-").map(Number)
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}T00:00:00+08:00`)
  const end   = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}T23:59:59+08:00`)
  return { start, end }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const querySecret = new URL(req.url).searchParams.get("secret")

  if (secret && authHeader !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { start, end } = getTomorrowTaipeiRangeUTC()
  console.log(`[CRON/reminder] ${start.toISOString()} ~ ${end.toISOString()}`)

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

  console.log(`[CRON/reminder] 找到 ${appointments.length} 筆預約`)

  let sent = 0, failed = 0

  for (const appt of appointments) {
    const customer = appt.pet.customer
    if (!customer.lineUserId) continue

    const twDate = new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei", month: "numeric", day: "numeric", weekday: "short",
    }).format(appt.scheduledAt)

    const twTime = new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(appt.scheduledAt)

    let services = "美容服務"
    try {
      const svcs = JSON.parse(appt.services ?? "[]") as { name: string }[]
      if (svcs.length > 0) services = svcs.map((s) => s.name).join("、")
    } catch { /* ignore */ }

    const template = appt.shop.reminderTemplate ?? DEFAULT_TEMPLATE
    const message = applyReminderTemplate(template, {
      name: customer.name,
      phone: customer.phone,
      date: twDate,
      time: twTime,
      services,
    })

    const ok = await sendLineMessage(customer.lineUserId, message, appt.shop.lineChannelToken)
    if (ok) sent++; else failed++
  }

  console.log(`[CRON/reminder] 完成：成功 ${sent}，失敗 ${failed}`)
  return NextResponse.json({ ok: true, total: appointments.length, sent, failed })
}
