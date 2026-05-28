import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.notification.count({ where: { shopId, isRead: false } }),
    ])
    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error("GET /api/notifications", error)
    return NextResponse.json({ error: "操作失敗" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const shopId = session.user.shopId
  try {
    const n = await prisma.notification.create({
      data: {
        shopId,
        type: body.type || "INFO",
        title: body.title,
        body: body.body || null,
        relatedId: body.relatedId || null,
      },
    })
    return NextResponse.json(n, { status: 201 })
  } catch (error) {
    console.error("POST /api/notifications", error)
    return NextResponse.json({ error: "操作失敗" }, { status: 500 })
  }
}

export async function PATCH() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  try {
    await prisma.notification.updateMany({
      where: { shopId, isRead: false },
      data: { isRead: true },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("PATCH /api/notifications", error)
    return NextResponse.json({ error: "操作失敗" }, { status: 500 })
  }
}
