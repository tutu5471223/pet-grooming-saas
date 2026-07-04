// Per-shop LINE webhook: each shop can have its own LINE Official Account.
// Signature is verified using the shop's lineChannelSecret (fallback: LINE_CHANNEL_SECRET env var).
// Replies and pushes use the shop's lineChannelToken (fallback: LINE_CHANNEL_ACCESS_TOKEN env var).
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

interface ShopLineConfig {
  id: string
  name: string
  lineChannelSecret: string | null
  lineChannelToken: string | null
}

async function replyMessage(replyToken: string, text: string, accessToken: string | null) {
  const token = accessToken ?? process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params

  const shop = await prisma.shop.findUnique({
    where: { id: shopId, status: "ACTIVE" },
    select: { id: true, name: true, lineChannelSecret: true, lineChannelToken: true },
  })
  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get("x-line-signature") ?? ""

  if (!verifyLineSignature(rawBody, signature, shop.lineChannelSecret)) {
    console.error(`[LINE Webhook][${shopId}] 簽名驗證失敗`)
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: LineWebhookBody
  try {
    body = JSON.parse(rawBody) as LineWebhookBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  void processShopEvents(shop, body.events)

  return NextResponse.json({ ok: true })
}

async function processShopEvents(shop: ShopLineConfig, events: LineEvent[]) {
  const token = shop.lineChannelToken

  for (const event of events) {
    const lineUserId = event.source?.userId
    if (!lineUserId) continue

    if (event.type === "follow") {
      if (event.replyToken) {
        await replyMessage(
          event.replyToken,
          `您好！感謝關注「${shop.name}」的 LINE 官方帳號 🐾\n\n請以「手機號碼 姓名」格式傳送（例如：0912345678 王小明），需與您在本店登記的資料一致，即可連結您的帳號，之後將自動收到預約確認、美容完工等通知。`,
          token
        )
      }
      continue
    }

    if (event.type === "message" && event.message?.type === "text") {
      const text = event.message.text?.trim() ?? ""

      const linkMatch = text.match(/^(09\d{8})[\s,，、]+(.{1,100})$/)
      if (linkMatch) {
        await handlePhoneLinking(shop, lineUserId, linkMatch[1], linkMatch[2].trim(), event.replyToken, token)
        continue
      }

      if (/^09\d{8}$/.test(text)) {
        if (event.replyToken) {
          await replyMessage(
            event.replyToken,
            "為保護您的個資，請以「手機號碼 姓名」格式傳送（例如：0912345678 王小明）才能完成帳號綁定。",
            token
          )
        }
        continue
      }

      if (/查詢|會員|我的資料|點數|儲值/.test(text)) {
        await handleMemberQuery(shop, lineUserId, event.replyToken, token)
        continue
      }

      if (event.replyToken) {
        await replyMessage(
          event.replyToken,
          "您好！如需連結帳號，請以「手機號碼 姓名」格式傳送（例如：0912345678 王小明）。\n如需查詢會員資料，請傳送「查詢」。",
          token
        )
      }
    }
  }
}

async function handlePhoneLinking(
  shop: ShopLineConfig,
  lineUserId: string,
  phone: string,
  name: string,
  replyToken?: string,
  accessToken?: string | null
) {
  const token = accessToken ?? null

  // Scoped to this shop only
  const customers = await prisma.customer.findMany({
    where: { phone, shopId: shop.id, status: "ACTIVE" },
  })

  const verified = customers.filter(
    (c) => c.name.trim().toLowerCase() === name.toLowerCase()
  )
  if (verified.length === 0) {
    if (replyToken) {
      await replyMessage(
        replyToken,
        "查無相符的會員資料，請確認手機號碼與姓名是否與店家登記一致，或洽詢店家協助。",
        token
      )
    }
    return
  }

  const bindable = verified.filter((c) => !c.lineUserId || c.lineUserId === lineUserId)
  if (bindable.length === 0) {
    if (replyToken) {
      await replyMessage(
        replyToken,
        "此會員資料已綁定其他 LINE 帳號。若需變更綁定，請洽詢店家協助。",
        token
      )
    }
    return
  }

  await prisma.customer.updateMany({
    where: { id: { in: bindable.map((c) => c.id) } },
    data: { lineUserId },
  })

  if (replyToken) {
    await replyMessage(
      replyToken,
      `帳號綁定成功！✅\n您的 LINE 已與「${shop.name}」的客戶資料完成綁定。\n之後預約確認、美容完工通知將自動傳送給您。`,
      token
    )
  }
}

async function handleMemberQuery(
  shop: ShopLineConfig,
  lineUserId: string,
  replyToken?: string,
  accessToken?: string | null
) {
  const token = accessToken ?? null

  // Scoped to this shop only
  const customers = await prisma.customer.findMany({
    where: { lineUserId, shopId: shop.id, status: "ACTIVE" },
    include: {
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
        "找不到您的會員資料。\n請先傳送您的手機號碼（09xxxxxxxx）完成帳號連結。",
        token
      )
    }
    return
  }

  const parts: string[] = []
  for (const customer of customers) {
    const remaining = customer.pets.reduce(
      (sum, pet) =>
        sum +
        pet.petMonthlyPlans.reduce(
          (s, p) => s + Math.max(0, p.maxSessions - p.usedSessions),
          0
        ),
      0
    )
    parts.push(
      `【${shop.name}】您的會員資料`,
      `👤 姓名：${customer.name}`,
      `💰 儲值餘額：$${Math.round(customer.storedValue).toLocaleString()}`,
      `⭐ 點數：${customer.points} 點`,
      `📅 包月剩餘：${remaining} 次`,
      `如有疑問請聯絡店家`
    )
  }

  if (replyToken) {
    await replyMessage(replyToken, parts.join("\n").trim(), token)
  }
}

// GET for LINE platform webhook verification ping
export async function GET() {
  return NextResponse.json({ status: "LINE webhook active" })
}
