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

  console.log(`[admin.shop.PATCH] 收到請求 shopId=${id} action=${body.action}${body.days ? ` days=${body.days}` : ""}`)

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
      const UNLIMITED = 999999

      // 永久訂閱要「移除所有用量限制」，因此必須把訂閱綁到「無限制方案」，
      // 而不是只改 status —— 否則訂閱仍掛在「免費試用」方案上，用量限制沒解除、
      // 前端「方案」欄仍顯示 plan.name「免費試用」。取用量無限制、價格最高的方案。
      const unlimitedPlan = await prisma.plan.findFirst({
        where: { maxCustomers: { gte: UNLIMITED } },
        orderBy: { price: "desc" },
      })

      // (2) 更新前：查詢該店家目前所有訂閱
      const before = await prisma.subscription.findMany({
        where: { shopId: id },
        select: { id: true, shopId: true, status: true, planId: true, currentPeriodEnd: true, createdAt: true },
      })
      console.log(`[admin.set_active] shopId=${id} 更新前訂閱(${before.length})=`, JSON.stringify(before), `無限制方案=${unlimitedPlan?.id ?? "無"}`)

      // (3) 一次更新該店家「所有」訂閱：狀態設 ACTIVE、到期日永久，並綁定無限制
      // 方案（若系統有的話）。updateMany 避免多筆／排序不穩時只改到某一筆。
      const updated = await prisma.subscription.updateMany({
        where: { shopId: id },
        data: {
          status: "ACTIVE",
          currentPeriodEnd: farFuture,
          ...(unlimitedPlan ? { planId: unlimitedPlan.id } : {}),
        },
      })
      console.log(`[admin.set_active] updateMany 更新筆數=${updated.count} planId=${unlimitedPlan?.id ?? "(未變更)"}`)

      if (updated.count === 0) {
        // 完全沒有訂閱紀錄才建立一筆：優先用無限制方案，否則退回最低價方案；
        // 若系統無任何方案則明確報錯，不再靜默回成功。
        const plan = unlimitedPlan ?? await prisma.plan.findFirst({ orderBy: { price: "asc" } })
        if (!plan) {
          console.log(`[admin.set_active] shopId=${id} 無任何訂閱且系統無方案，無法建立`)
          return NextResponse.json(
            { error: "系統尚無任何方案，無法建立永久訂閱" },
            { status: 400 }
          )
        }
        const created = await prisma.subscription.create({
          data: {
            shopId: id,
            planId: plan.id,
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: farFuture,
          },
        })
        console.log(`[admin.set_active] shopId=${id} 原無訂閱，已建立新訂閱 id=${created.id} planId=${plan.id}`)
      }

      // (4) 更新後：重新查詢確認實際落庫的狀態與方案
      const after = await prisma.subscription.findMany({
        where: { shopId: id },
        select: { id: true, status: true, planId: true, currentPeriodEnd: true },
      })
      console.log(`[admin.set_active] shopId=${id} 更新後訂閱(${after.length})=`, JSON.stringify(after))

      await writeAudit({
        shopId: id,
        userId: session.user.id,
        action: "admin.shop.set_active",
        resource: "shop",
        resourceId: id,
        detail: { updatedCount: updated.count, planId: unlimitedPlan?.id },
      })
      return NextResponse.json({ success: true, updated: updated.count })
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
