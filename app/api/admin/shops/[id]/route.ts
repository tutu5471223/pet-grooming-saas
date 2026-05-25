import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const shop = await prisma.shop.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true, isActive: true, isSuperAdmin: true } },
        _count: { select: { customers: true, appointments: true } },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
      },
    })
    if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(shop)
  } catch (error) {
    console.error("GET /api/admin/shops/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  try {
    if (body.action === "extend_trial") {
      const days = Number(body.days) || 7
      const existing = await prisma.subscription.findFirst({
        where: { shopId: id },
        orderBy: { createdAt: "desc" },
      })
      if (existing) {
        const newEnd = new Date(Math.max(existing.currentPeriodEnd.getTime(), Date.now()))
        newEnd.setDate(newEnd.getDate() + days)
        await prisma.subscription.update({
          where: { id: existing.id },
          data: { currentPeriodEnd: newEnd, status: "TRIAL" },
        })
      }
      return NextResponse.json({ success: true })
    }

    if (body.action === "disable_shop") {
      await prisma.user.updateMany({ where: { shopId: id }, data: { isActive: false } })
      return NextResponse.json({ success: true })
    }

    if (body.action === "enable_shop") {
      await prisma.user.updateMany({ where: { shopId: id }, data: { isActive: true } })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("PATCH /api/admin/shops/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
