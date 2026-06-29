import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { readJson, shortText, longText, z } from "@/lib/validation"

async function getSession() {
  const session = await auth()
  if (!session?.user?.shopId) return null
  return session
}

function notifWhere(shopId: string, isSuperAdmin: boolean, extraFilter?: object) {
  const shopIdFilter = isSuperAdmin
    ? { in: [shopId, "system"] }
    : shopId
  return { shopId: shopIdFilter, ...extraFilter }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { shopId, isSuperAdmin } = { shopId: session.user.shopId, isSuperAdmin: session.user.isSuperAdmin ?? false }
  const where = notifWhere(shopId, isSuperAdmin)

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.notification.count({ where: { ...notifWhere(shopId, isSuperAdmin), isRead: false } }),
    ])
    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error("GET /api/notifications", error)
    return NextResponse.json({ error: "操作失敗" }, { status: 500 })
  }
}

const createSchema = z.object({
  type: shortText.optional(),
  title: shortText.min(1),
  body: longText.nullish(),
  relatedId: shortText.nullish(),
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { shopId } = session.user

  try {
    const parsed = await readJson(req, createSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data

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
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { shopId, isSuperAdmin } = { shopId: session.user.shopId, isSuperAdmin: session.user.isSuperAdmin ?? false }

  try {
    await prisma.notification.updateMany({
      where: { ...notifWhere(shopId, isSuperAdmin), isRead: false },
      data: { isRead: true },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("PATCH /api/notifications", error)
    return NextResponse.json({ error: "操作失敗" }, { status: 500 })
  }
}
