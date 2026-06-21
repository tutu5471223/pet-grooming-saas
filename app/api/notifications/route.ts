import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { readJson, shortText, longText, z } from "@/lib/validation"

export async function GET() {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

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

const createSchema = z.object({
  type: shortText.optional(),
  title: shortText.min(1),
  body: longText.nullish(),
  relatedId: shortText.nullish(),
})

export async function POST(req: NextRequest) {
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
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

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
