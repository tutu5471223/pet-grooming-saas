import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyLineSignature, sendLineMessage } from "@/lib/line"

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
      "Content-Type": "application/json",
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
    const lineUserId = event.source?.userId
    if (!lineUserId) continue

    if (event.type === "follow") {
      // Welcome message when user follows the official account
      if (event.replyToken) {
        await replyMessage(
          event.replyToken,
          "您好！感謝關注我們的 LINE 官方帳號 🐾\n\n請傳送您在本店登記的手機號碼（格式：09xxxxxxxx），即可連結您的帳號，之後將自動收到預約確認、美容完工等通知。"
        )
      }
      continue
    }

    if (event.type === "message" && event.message?.type === "text") {
      const text = event.message.text?.trim() ?? ""

      // Phone number sent → link to customer account
      if (/^09\d{8}$/.test(text)) {
        await handlePhoneLinking(lineUserId, text, event.replyToken)
        continue
      }

      // Any other message → generic reply
      if (event.replyToken) {
        await replyMessage(
          event.replyToken,
          "您好！如需連結帳號，請傳送您登記的手機號碼（格式：09xxxxxxxx）。"
        )
      }
    }
  }
}

async function handlePhoneLinking(lineUserId: string, phone: string, replyToken?: string) {
  // Find customer by phone across all shops
  const customers = await prisma.customer.findMany({
    where: { phone, status: "ACTIVE" },
    include: { shop: { select: { name: true } } },
  })

  if (customers.length === 0) {
    if (replyToken) {
      await replyMessage(replyToken, `找不到手機號碼 ${phone} 對應的客人資料，請確認號碼是否正確，或洽詢店家協助。`)
    }
    return
  }

  // Update all matching customers with this LINE User ID
  // lineUserId → used for push messages; lineId keeps the admin-entered display handle
  console.log(`[LINE Webhook] 綁定 lineUserId=${lineUserId} phone=${phone} 共 ${customers.length} 筆`)
  await prisma.customer.updateMany({
    where: { phone, status: "ACTIVE" },
    data: { lineUserId },
  })

  const shopNames = [...new Set(customers.map((c) => c.shop.name))].join("、")
  if (replyToken) {
    await replyMessage(
      replyToken,
      `帳號連結成功！✅\n您的 LINE 已與「${shopNames}」的客戶資料完成綁定。\n之後預約確認、美容完工通知將自動傳送給您。`
    )
  }
}

// GET for webhook URL verification (LINE platform ping)
export async function GET() {
  return NextResponse.json({ status: "LINE webhook active" })
}
