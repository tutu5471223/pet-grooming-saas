import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { readJson, z } from "@/lib/validation"
import { sendEmail } from "@/lib/email"

const adminShopActionSchema = z.object({
  action: z.enum(["extend_trial", "set_active", "disable_shop", "enable_shop", "approve_shop"]),
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

    if (body.action === "set_active") {
      const farFuture = new Date("2099-01-01")
      const existing = await prisma.subscription.findFirst({
        where: { shopId: id },
        orderBy: { createdAt: "desc" },
      })
      if (existing) {
        await prisma.subscription.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", currentPeriodEnd: farFuture },
        })
      } else {
        // No subscription exists; create a permanent one with the first available plan
        const plan = await prisma.plan.findFirst({ orderBy: { price: "asc" } })
        if (plan) {
          await prisma.subscription.create({
            data: { shopId: id, planId: plan.id, status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: farFuture },
          })
        }
      }
      await writeAudit({
        shopId: id,
        userId: session.user.id,
        action: "admin.shop.set_active",
        resource: "shop",
        resourceId: id,
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

    if (body.action === "approve_shop") {
      const shop = await prisma.shop.findUnique({
        where: { id },
        include: { users: { where: { role: "OWNER" }, select: { email: true, name: true }, take: 1 } },
      })
      if (!shop) return NextResponse.json({ error: "找不到此店家" }, { status: 404 })

      await prisma.shop.update({ where: { id }, data: { status: "ACTIVE" } })
      await writeAudit({
        shopId: id,
        userId: session.user.id,
        action: "admin.shop.approve",
        resource: "shop",
        resourceId: id,
      })

      const owner = shop.users[0]
      if (owner?.email) {
        await sendEmail({
          to: owner.email,
          subject: "【PetOS71】您的申請已審核通過",
          html: `
            <p>您好，${owner.name ? owner.name + " 您好，" : ""}感謝您申請 PetOS71！</p>
            <p>恭喜您的店家申請已通過審核，您現在可以登入系統開始使用。</p>
            <table cellpadding="6" style="border-collapse:collapse;margin:12px 0">
              <tr><td style="color:#555">店家名稱</td><td><strong>${shop.name}</strong></td></tr>
              <tr><td style="color:#555">店家 ID</td><td style="font-family:monospace">${id}</td></tr>
            </table>
            <p>
              <a href="https://petos71.com/login"
                 style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
                立即登入
              </a>
            </p>
            <p style="color:#888;font-size:13px;margin-top:16px">
              登入網址：<a href="https://petos71.com/login" style="color:#4f46e5">https://petos71.com/login</a>
            </p>
          `,
        })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("PATCH /api/admin/shops/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
