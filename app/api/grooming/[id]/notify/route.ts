import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendLineMessage, buildBaseUrl } from "@/lib/line"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId
  const baseUrl = buildBaseUrl(req)

  try {
    const record = await prisma.groomingRecord.findFirst({
      where: { id, shopId },
      include: { pet: { include: { customer: true } } },
    })
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const customer = record.pet.customer
    if (!customer.lineUserId) {
      return NextResponse.json({ error: "客人尚未綁定 LINE 帳號" }, { status: 422 })
    }

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { name: true, lineChannelToken: true },
    })

    const viewUrl = `${baseUrl}/grooming/${record.viewToken}`
    const msg = [
      `【${shop?.name ?? "寵物美容店"}】`,
      `${record.pet.name} 的美容服務已完成，感謝您的光臨！`,
      ``,
      `📋 請點擊以下連結查看本次美容紀錄：`,
      viewUrl,
    ].join("\n")

    const ok = await sendLineMessage(customer.lineUserId, msg, shop?.lineChannelToken ?? null)
    if (!ok) {
      return NextResponse.json({ error: "LINE 推播失敗，請確認 LINE 設定" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST /api/grooming/[id]/notify", error)
    return NextResponse.json({ error: "伺服器錯誤，請稍後再試" }, { status: 500 })
  }
}
