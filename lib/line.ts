import { createHmac } from "crypto"

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"]

export function verifyLineSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) return false
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64")
  return expected === signature
}

// Send a LINE push message. Uses shop's own token if provided, falls back to env var.
export async function sendLineMessage(
  lineUserId: string,
  text: string,
  accessToken?: string | null
): Promise<boolean> {
  const token = accessToken ?? process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.log("[LINE] 無 ACCESS_TOKEN，略過發送")
    return false
  }
  if (!lineUserId) {
    console.log("[LINE] 無 lineUserId，略過發送")
    return false
  }
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text }],
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error("[LINE] push 失敗", res.status, errText)
      return false
    }
    // SEC-7: don't log the full LINE userId (PII) — truncate.
    console.log("[LINE] 推播成功 →", lineUserId.slice(0, 6) + "***")
    return true
  } catch (err) {
    console.error("[LINE] push error:", err)
    return false
  }
}

export function buildBaseUrl(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "localhost:3000"
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

export function formatTWDatetime(date: Date): string {
  const d = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date)
  const parts: Record<string, string> = {}
  d.forEach((p) => { parts[p.type] = p.value })
  const weekday = WEEKDAYS[new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date)).getDay()]
  // new Date of the Taiwan date string to get weekday
  const twDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date)
  const twWeekday = WEEKDAYS[new Date(twDateStr + "T00:00:00").getDay()]
  return `${parts.month}/${parts.day}（${twWeekday}）${parts.hour}:${parts.minute}`
}

// LINE-1: cap each substituted value so an over-long customer-controlled field
// (name/notes/services) can't bloat the outbound message.
const cap = (s: string, n: number) => (s ?? "").slice(0, n)

export function applyReminderTemplate(
  template: string,
  vars: { name: string; phone: string; time: string; date: string; services: string }
): string {
  return template
    .replace(/\{name\}/g, cap(vars.name, 60))
    .replace(/\{phone\}/g, cap(vars.phone, 30))
    .replace(/\{time\}/g, cap(vars.time, 30))
    .replace(/\{date\}/g, cap(vars.date, 30))
    .replace(/\{services\}/g, cap(vars.services, 200))
}
