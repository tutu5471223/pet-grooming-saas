// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()

    const service = await prisma.service.updateMany({
      where: { id, shopId: session.user.shopId },
      data: {
        name: body.name ?? undefined,
        category: body.category !== undefined ? (body.category || null) : undefined,
        price: body.price !== undefined ? Number(body.price) : undefined,
        duration: body.duration !== undefined ? (body.duration ? Number(body.duration) : null) : undefined,
        isActive: body.isActive !== undefined ? body.isActive : undefined,
      },
    })
    return NextResponse.json(service)
  } catch (error) {
    console.error("PATCH /api/services/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    await prisma.service.updateMany({
      where: { id, shopId: session.user.shopId },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/services/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
