// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const levels = await prisma.memberLevel.findMany({
      where: { shopId: session.user.shopId },
      orderBy: { minPoints: "asc" },
    })
    return NextResponse.json(levels)
  } catch (error) {
    console.error("GET /api/member-levels", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const body = await req.json()
    const level = await prisma.memberLevel.create({
      data: {
        shopId: session.user.shopId,
        name: body.name,
        minPoints: Number(body.minPoints) || 0,
        discountRate: Number(body.discountRate) || 0,
        benefits: body.benefits || null,
        color: body.color || "#6366f1",
      },
    })
    return NextResponse.json(level, { status: 201 })
  } catch (error) {
    console.error("POST /api/member-levels", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
