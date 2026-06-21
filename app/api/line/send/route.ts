import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendLineMessage } from "@/lib/line"
import { requireAuth } from "@/lib/auth-guard"
import { enforceRateLimit } from "@/lib/rate-limit"
import { readJson, shortText, longText, z } from "@/lib/validation"

// TEN-4: never accept a raw recipient lineUserId from the client. The caller may
// only target a customer (by id) that belongs to their own shop; we resolve the
// stored lineUserId server-side.
const sendSchema = z.object({
  customerId: shortText.min(1),
  message: longText.min(1),
})

export async function POST(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  // Per-shop rate limit (LINE push is a billed external resource / anti-abuse).
  const limited = enforceRateLimit(`line-send:${shopId}`, 30, 60_000)
  if (limited) return limited

  const parsed = await readJson(req, sendSchema)
  if (!parsed.ok) return parsed.response
  const { customerId, message } = parsed.data

  if (!message.trim()) {
    return NextResponse.json({ error: "訊息不能為空" }, { status: 400 })
  }

  // Look up the customer scoped to this shop and use ITS stored lineUserId.
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, shopId },
    select: { lineUserId: true, name: true },
  })
  if (!customer) {
    return NextResponse.json({ error: "找不到客人" }, { status: 404 })
  }
  if (!customer.lineUserId) {
    return NextResponse.json(
      { error: `${customer.name} 尚未綁定 LINE 帳號（請客人加好友後完成綁定）` },
      { status: 422 }
    )
  }

  // Use shop's own token if configured, otherwise fall back to env.
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { lineChannelToken: true },
  })

  try {
    const sent = await sendLineMessage(customer.lineUserId, message, shop?.lineChannelToken)
    if (!sent) {
      return NextResponse.json(
        { error: "LINE 訊息發送失敗，請確認 LINE Channel Token 設定" },
        { status: 503 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[LINE Send] error:", err)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
