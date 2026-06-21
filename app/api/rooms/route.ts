// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { readJson, money, shortText, longText, z } from "@/lib/validation"
import { round2 } from "@/lib/money"

export async function GET() {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    const rooms = await prisma.boardingRoom.findMany({
      where: { shopId },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rooms)
  } catch (error) {
    console.error("GET /api/rooms", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

const createSchema = z.object({
  name: shortText.min(1),
  type: shortText.nullish(),
  dailyRate: money.optional(),
  notes: longText.nullish(),
})

export async function POST(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    const parsed = await readJson(req, createSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data

    const room = await prisma.boardingRoom.create({
      data: {
        shopId,
        name: body.name,
        type: body.type || null,
        dailyRate: round2(body.dailyRate ?? 0),
        notes: body.notes || null,
      },
    })
    return NextResponse.json(room, { status: 201 })
  } catch (error) {
    console.error("POST /api/rooms", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
