// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  try {
    const level = await prisma.memberLevel.updateMany({
      where: { id, shopId: session.user.shopId },
      data: {
        name: body.name ?? undefined,
        minPoints: body.minPoints !== undefined ? Number(body.minPoints) : undefined,
        discountRate: body.discountRate !== undefined ? Number(body.discountRate) : undefined,
        benefits: body.benefits !== undefined ? (body.benefits || null) : undefined,
        color: body.color ?? undefined,
      },
    })
    return NextResponse.json(level)
  } catch (error) {
    console.error("PATCH /api/member-levels/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const { id } = await params
    await prisma.memberLevel.deleteMany({ where: { id, shopId: session.user.shopId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/member-levels/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
