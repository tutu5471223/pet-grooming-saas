// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"

export async function GET(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")?.slice(0, 50) || null

  try {
    const rooms = await prisma.boardingRoom.findMany({
      where: { shopId, ...(status ? { status } : {}) },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(rooms)
  } catch (error) {
    console.error("GET /api/boarding/rooms", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
