import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { readJson, z } from "@/lib/validation"

const adminShopActionSchema = z.object({
  action: z.enum(["extend_trial", "disable_shop", "enable_shop"]),
  days: z.number().int().positive().max(3650).optional(),
})

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

  const parsed = await readJson(req, adminShopActionSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    if (body.action === "extend_trial") {
      const days = body.days ?? 7
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
      await writeAudit({
        shopId: id,
        userId: session.user.id,
        action: "admin.shop.extend_trial",
        resource: "shop",
        resourceId: id,
        detail: { days },
      })
      return NextResponse.json({ success: true })
    }

    if (body.action === "disable_shop") {
      await prisma.user.updateMany({ where: { shopId: id }, data: { isActive: false } })
      await writeAudit({
        shopId: id,
        userId: session.user.id,
        action: "admin.shop.disable",
        resource: "shop",
        resourceId: id,
      })
      return NextResponse.json({ success: true })
    }

    if (body.action === "enable_shop") {
      await prisma.user.updateMany({ where: { shopId: id }, data: { isActive: true } })
      await writeAudit({
        shopId: id,
        userId: session.user.id,
        action: "admin.shop.enable",
        resource: "shop",
        resourceId: id,
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("PATCH /api/admin/shops/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
