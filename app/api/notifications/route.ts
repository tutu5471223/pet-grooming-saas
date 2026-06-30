import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { readJson, shortText, longText, z } from "@/lib/validation"

function notifWhere(shopId: string, isSuperAdmin: boolean, extraFilter?: object) {
  const shopIdFilter = isSuperAdmin
    ? { in: [shopId, "system"] }
    : shopId
  return { shopId: shopIdFilter, ...extraFilter }
}

export async function GET() {
  // C1: central guard (401 if no shopId / 403 if shop not ACTIVE).
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId, isSuperAdmin } = guard.ctx
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
  // C1: central guard (401/403).
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

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
  // C1: central guard (401/403).
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId, isSuperAdmin } = guard.ctx

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
