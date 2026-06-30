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
    const lineUserId = event.source?.userId
    if (!lineUserId) continue

    if (event.type === "follow") {
      if (event.replyToken) {
        await replyMessage(
          event.replyToken,
          "您好！感謝關注我們的 LINE 官方帳號 🐾\n\n請以「手機號碼 姓名」格式傳送（例如：0912345678 王小明），需與您在本店登記的資料一致，即可連結您的帳號，之後將自動收到預約確認、美容完工等通知。"
        )
      }
      continue
    }

    if (event.type === "message" && event.message?.type === "text") {
      const text = event.message.text?.trim() ?? ""

      // H1: account binding requires phone + name (a second factor), mirroring
      // the AUTH-4 design of booking/lookup. A phone number alone must never
      // bind an account or disclose balance/PII — anyone could guess a phone.
      const linkMatch = text.match(/^(09\d{8})[\s,，、]+(.{1,100})$/)
      if (linkMatch) {
        await handlePhoneLinking(lineUserId, linkMatch[1], linkMatch[2].trim(), event.replyToken)
        continue
      }

      // Bare phone → ask for the name too; do NOT link or disclose anything.
      if (/^09\d{8}$/.test(text)) {
        if (event.replyToken) {
          await replyMessage(
            event.replyToken,
            "為保護您的個資，請以「手機號碼 姓名」格式傳送（例如：0912345678 王小明）才能完成帳號綁定。"
          )
        }
        continue
      }

      // Member query keywords
      if (/查詢|會員|我的資料|點數|儲值/.test(text)) {
        await handleMemberQuery(lineUserId, event.replyToken)
        continue
      }

      // Any other message → generic reply
      if (event.replyToken) {
        await replyMessage(
          event.replyToken,
          "您好！如需連結帳號，請以「手機號碼 姓名」格式傳送（例如：0912345678 王小明）。\n如需查詢會員資料，請傳送「查詢」。"
        )
      }
    }
  }
}

async function handlePhoneLinking(
  lineUserId: string,
  phone: string,
  name: string,
  replyToken?: string
) {
  const customers = await prisma.customer.findMany({
    where: { phone, status: "ACTIVE" },
    include: { shop: { select: { name: true } } },
  })

  // H1: second factor — the supplied name must match. Non-confirming response:
  // "no such phone" and "wrong name" return the identical message so a caller
  // cannot enumerate which phones are registered.
  const verified = customers.filter(
    (c) => c.name.trim().toLowerCase() === name.toLowerCase()
  )
  if (verified.length === 0) {
    if (replyToken) {
      await replyMessage(
        replyToken,
        "查無相符的會員資料，請確認手機號碼與姓名是否與店家登記一致，或洽詢店家協助。"
      )
    }
    return
  }

  // H1: anti-hijack — never overwrite a record already bound to a DIFFERENT
  // LINE account. Only bind records that are unbound or already this user's.
  const bindable = verified.filter((c) => !c.lineUserId || c.lineUserId === lineUserId)
  const blockedCount = verified.length - bindable.length
  if (bindable.length === 0) {
    if (replyToken) {
      await replyMessage(
        replyToken,
        "此會員資料已綁定其他 LINE 帳號。若需變更綁定，請洽詢店家協助。"
      )
    }
    return
  }

  await prisma.customer.updateMany({
    where: { id: { in: bindable.map((c) => c.id) } },
    data: { lineUserId },
  })

  const shopNames = [...new Set(bindable.map((c) => c.shop.name))].join("、")
  if (replyToken) {
    await replyMessage(
      replyToken,
      `帳號綁定成功！✅\n您的 LINE 已與「${shopNames}」的客戶資料完成綁定。\n之後預約確認、美容完工通知將自動傳送給您。` +
        (blockedCount > 0 ? "\n（部分資料已綁定其他帳號，未變更。）" : "")
    )
  }
}

async function handleMemberQuery(lineUserId: string, replyToken?: string) {
  const customers = await prisma.customer.findMany({
    where: { lineUserId, status: "ACTIVE" },
    include: {
      shop: { select: { name: true } },
      pets: {
        where: { isActive: true },
        include: {
          petMonthlyPlans: {
            where: { endDate: { gte: new Date() } },
            select: { maxSessions: true, usedSessions: true },
          },
        },
      },
    },
  })

  if (customers.length === 0) {
    if (replyToken) {
      await replyMessage(
        replyToken,
        "找不到您的會員資料。\n請先傳送您的手機號碼（09xxxxxxxx）完成帳號連結。"
      )
    }
    return
  }

  const parts: string[] = []
  for (const customer of customers) {
    const remaining = customer.pets.reduce((sum, pet) =>
      sum + pet.petMonthlyPlans.reduce((s, p) => s + Math.max(0, p.maxSessions - p.usedSessions), 0), 0)

    parts.push(
      `【${customer.shop.name}】您的會員資料`,
      `👤 姓名：${customer.name}`,
      `💰 儲值餘額：$${Math.round(customer.storedValue).toLocaleString()}`,
      `⭐ 點數：${customer.points} 點`,
      `📅 包月剩餘：${remaining} 次`,
      `如有疑問請聯絡店家`,
    )
    if (customers.length > 1) parts.push("")
  }

  if (replyToken) {
    await replyMessage(replyToken, parts.join("\n").trim())
  }
}

// GET for webhook URL verification (LINE platform ping)
export async function GET() {
  return NextResponse.json({ status: "LINE webhook active" })
}
