import { NextRequest, NextResponse } from "next/server"
import { verifyLineSignature } from "@/lib/line"

interface LineEvent {
  type: string
  source?: { userId?: string; type?: string }
  message?: { type: string; text?: string }
  replyToken?: string
}

interface LineWebhookBody {
  events: LineEvent[]
  destination?: string
}

async function replyMessage(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-line-signature") ?? ""

  if (!verifyLineSignature(rawBody, signature)) {
    console.error("[LINE Webhook] 簽名驗證失敗")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: LineWebhookBody
  try {
    body = JSON.parse(rawBody) as LineWebhookBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Process events asynchronously (LINE expects fast 200 response)
  void processEvents(body.events)

  return NextResponse.json({ ok: true })
}

async function processEvents(events: LineEvent[]) {
  for (const event of events) {
    // We intentionally do not read or persist the inbound LINE userId here
    // (AUTH-3): no cross-shop binding or PII disclosure from the webhook.
    if (!event.source?.userId) continue

    if (event.type === "follow") {
      // Welcome message when user follows the official account.
      // AUTH-3: do NOT instruct the user to send a phone number for auto-binding —
      // binding must be done by the shop (explicit verification), not by anyone
      // who happens to know a phone number.
      if (event.replyToken) {
        await replyMessage(
          event.replyToken,
          "您好！感謝關注我們的 LINE 官方帳號 🐾\n\n如需綁定帳號以接收預約確認、美容完工等通知，請直接洽詢您的店家協助完成綁定。"
        )
      }
      continue
    }

    if (event.type === "message" && event.message?.type === "text") {
      // AUTH-3: this is a single global LINE channel shared across all tenants.
      // We can no longer determine which shop an inbound user belongs to in a
      // trustworthy way, and we must never disclose balances/points/names or
      // auto-bind a LINE userId to a customer by an unverified phone number
      // (that would leak/cross-link PII across shops). Until a proper per-shop
      // one-time binding-code flow exists, reply with a safe, generic message
      // only — no lookups, no PII, no writes.
      if (event.replyToken) {
        await replyMessage(
          event.replyToken,
          "您好！如需綁定帳號或查詢會員資料，請直接洽詢您的店家協助，謝謝 🐾"
        )
      }
    }
  }
}

// GET for webhook URL verification (LINE platform ping)
export async function GET() {
  return NextResponse.json({ status: "LINE webhook active" })
}
