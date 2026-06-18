import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendLineMessage } from "@/lib/line"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const body = await req.json() as {
    customerId?: string
    lineUserId?: string
    message: string
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "訊息不能為空" }, { status: 400 })
  }

  let lineUserId = body.lineUserId ?? null

  // Look up customer's lineUserId if customerId provided
  if (!lineUserId && body.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, shopId },
      select: { lineUserId: true, name: true },
    })
    if (!customer) {
      return NextResponse.json({ error: "找不到客人" }, { status: 404 })
    }
    if (!customer.lineUserId) {
      return NextResponse.json({ error: `${customer.name} 尚未綁定 LINE 帳號（請客人加好友後傳送手機號碼）` }, { status: 422 })
    }
    lineUserId = customer.lineUserId
  }

  if (!lineUserId) {
    return NextResponse.json({ error: "缺少 LINE User ID" }, { status: 400 })
  }

  // Use shop's own token if configured, otherwise fall back to env
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { lineChannelToken: true },
  })

  const sent = await sendLineMessage(lineUserId, body.message, shop?.lineChannelToken)
  if (!sent) {
    return NextResponse.json({ error: "LINE 訊息發送失敗，請確認 LINE Channel Token 設定" }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}
