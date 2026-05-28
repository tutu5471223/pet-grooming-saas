import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId

  try {
    const room = await prisma.boardingRoom.findFirst({ where: { id, shopId } })
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const activeBoarding = await prisma.boardingRecord.findFirst({
      where: { roomId: id, status: "STAYING" },
    })
    if (activeBoarding) {
      return NextResponse.json({ error: "房間目前有寵物住宿，無法刪除" }, { status: 409 })
    }

    await prisma.boardingRoom.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE /api/rooms/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId
  const body = await req.json()

  try {
    const room = await prisma.boardingRoom.findFirst({ where: { id, shopId } })
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const updated = await prisma.boardingRoom.update({
      where: { id },
      data: {
        name: body.name ?? room.name,
        type: body.type ?? room.type,
        dailyRate: body.dailyRate ?? room.dailyRate,
        status: body.status ?? room.status,
        notes: body.notes ?? room.notes,
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/rooms/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
