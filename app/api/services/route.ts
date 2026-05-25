// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const services = await prisma.service.findMany({
      where: { shopId: session.user.shopId, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    })
    return NextResponse.json(services)
  } catch (error) {
    console.error("GET /api/services", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const service = await prisma.service.create({
      data: {
        shopId: session.user.shopId,
        name: body.name,
        category: body.category || null,
        price: body.price || 0,
        duration: body.duration || null,
        description: body.description || null,
      },
    })
    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    console.error("POST /api/services", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
