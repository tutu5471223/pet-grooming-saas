// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  // Ensure shop belongs to this session
  if (id !== session.user.shopId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()

  try {
    const shop = await prisma.shop.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        phone: body.phone ?? undefined,
        address: body.address ?? undefined,
        lineId: body.lineId ?? undefined,
        email: body.email ?? undefined,
        logoUrl: body.logoUrl ?? undefined,
        businessHoursStart: body.businessHoursStart ?? undefined,
        businessHoursEnd: body.businessHoursEnd ?? undefined,
        restDays: body.restDays !== undefined ? JSON.stringify(body.restDays) : undefined,
        reminderTemplate: body.reminderTemplate ?? undefined,
        contractTemplate: body.contractTemplate ?? undefined,
      },
    })

    return NextResponse.json(shop)
  } catch (error) {
    console.error("PATCH /api/shops/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
