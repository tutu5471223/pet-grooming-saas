import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { readJson, money, shortText, longText, z } from "@/lib/validation"
import { round2 } from "@/lib/money"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { id } = await params

  try {
    const room = await prisma.boardingRoom.findFirst({ where: { id, shopId } })
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const activeBoarding = await prisma.boardingRecord.findFirst({
      where: { roomId: id, shopId, status: "STAYING" },
    })
    if (activeBoarding) {
      return NextResponse.json({ error: "房間目前有寵物住宿，無法刪除" }, { status: 409 })
    }

    await prisma.boardingRoom.deleteMany({ where: { id, shopId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE /api/rooms/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

const patchSchema = z.object({
  name: shortText.min(1).optional(),
  type: shortText.nullish(),
  dailyRate: money.optional(),
  status: shortText.optional(),
  notes: longText.nullish(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { id } = await params

  try {
    const parsed = await readJson(req, patchSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data

    const room = await prisma.boardingRoom.findFirst({ where: { id, shopId } })
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const updated = await prisma.boardingRoom.update({
      where: { id },
      data: {
        name: body.name ?? room.name,
        type: body.type !== undefined ? (body.type ?? null) : room.type,
        dailyRate: body.dailyRate !== undefined ? round2(body.dailyRate) : room.dailyRate,
        status: body.status ?? room.status,
        notes: body.notes !== undefined ? (body.notes ?? null) : room.notes,
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/rooms/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
