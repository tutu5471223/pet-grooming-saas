// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const rooms = await prisma.boardingRoom.findMany({
      where: { shopId: session.user.shopId },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rooms)
  } catch (error) {
    console.error("GET /api/rooms", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const room = await prisma.boardingRoom.create({
      data: {
        shopId: session.user.shopId,
        name: body.name,
        type: body.type || null,
        dailyRate: body.dailyRate || 0,
        notes: body.notes || null,
      },
    })
    return NextResponse.json(room, { status: 201 })
  } catch (error) {
    console.error("POST /api/rooms", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
