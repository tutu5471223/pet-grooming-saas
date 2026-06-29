// SECURITY: superadmin-only endpoint
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { writeAudit } from "@/lib/audit"
import { readJson, z } from "@/lib/validation"

const superadminShopActionSchema = z.object({
  action: z.enum(["approve", "reject", "suspend", "activate"]),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const parsed = await readJson(req, superadminShopActionSchema)
  if (!parsed.ok) return parsed.response
  const { action } = parsed.data

  const shop = await prisma.shop.findUnique({
    where: { id },
    include: { users: { where: { role: "OWNER" }, select: { email: true, name: true }, take: 1 } },
  })
  if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const STATUS_MAP: Record<string, string> = {
    approve: "ACTIVE",
    reject: "REJECTED",
    suspend: "SUSPENDED",
    activate: "ACTIVE",
  }
  const newStatus = STATUS_MAP[action]
  if (!newStatus) return NextResponse.json({ error: "Invalid action" }, { status: 400 })

  await prisma.shop.update({ where: { id }, data: { status: newStatus } })

  await writeAudit({
    shopId: id,
    userId: session.user.id,
    action: `superadmin.shop.${action}`,
    resource: "shop",
    resourceId: id,
    detail: { status: newStatus },
  })

  const owner = shop.users[0]
  if (owner?.email) {
    if (action === "approve") {
      await sendEmail({
        to: owner.email,
        subject: "【PetOS71】您的申請已審核通過",
        html: `
          <p>您好${owner.name ? `，${owner.name}` : ""}，感謝您申請 PetOS71！</p>
          <p>恭喜您的店家申請已通過審核，您現在可以登入系統開始使用。</p>
          <table cellpadding="6" style="border-collapse:collapse;margin:12px 0">
            <tr><td style="color:#555">店家名稱</td><td><strong>${shop.name}</strong></td></tr>
            <tr><td style="color:#555">店家 ID</td><td style="font-family:monospace">${shop.id}</td></tr>
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
    } else if (action === "reject") {
      await sendEmail({
        to: owner.email,
        subject: "【PetOS71】您的店家申請結果通知",
        html: `
          <p>您好${owner.name ? `，${owner.name}` : ""}，</p>
          <p>很抱歉，您的店家「${shop.name}」申請未通過審核。</p>
          <p>如有疑問請聯絡客服：<a href="mailto:tutu5471223@gmail.com">tutu5471223@gmail.com</a></p>
        `,
      })
    } else if (action === "suspend") {
      await sendEmail({
        to: owner.email,
        subject: "【PetOS71】您的店家帳號已暫停",
        html: `
          <p>您好${owner.name ? `，${owner.name}` : ""}，</p>
          <p>您的店家「${shop.name}」帳號已被暫停，如有疑問請聯絡客服：<a href="mailto:tutu5471223@gmail.com">tutu5471223@gmail.com</a></p>
        `,
      })
    }
  }

  return NextResponse.json({ ok: true, status: newStatus })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  // Protect the system shop and active shops
  if (id === "system") {
    return NextResponse.json({ error: "系統店家不可刪除" }, { status: 400 })
  }

  const shop = await prisma.shop.findUnique({ where: { id }, select: { status: true, name: true } })
  if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (shop.status !== "SUSPENDED" && shop.status !== "REJECTED") {
    return NextResponse.json({ error: "只有已停用或已拒絕的店家才能刪除" }, { status: 400 })
  }

  // Delete in dependency order to avoid FK constraint violations.
  // Child tables with onDelete:Cascade (e.g. Pet→GroomingRecord) are handled
  // automatically; the rest must be deleted explicitly before their parent.
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { shopId: id } }),
    prisma.subscription.deleteMany({ where: { shopId: id } }),
    prisma.auditLog.deleteMany({ where: { shopId: id } }),
    prisma.payment.deleteMany({ where: { shopId: id } }),
    prisma.expense.deleteMany({ where: { shopId: id } }),
    prisma.appointment.deleteMany({ where: { shopId: id } }),
    // Sale → SaleItem cascades automatically
    prisma.sale.deleteMany({ where: { shopId: id } }),
    prisma.product.deleteMany({ where: { shopId: id } }),
    // BoardingDailyLog before BoardingRecord
    prisma.boardingDailyLog.deleteMany({ where: { shopId: id } }),
    prisma.boardingRecord.deleteMany({ where: { shopId: id } }),
    prisma.boardingRoom.deleteMany({ where: { shopId: id } }),
    // StoredValueHistory / PointsHistory before Customer
    prisma.storedValueHistory.deleteMany({ where: { shopId: id } }),
    prisma.pointsHistory.deleteMany({ where: { shopId: id } }),
    // Customer → Pet → (GroomingRecord, Contract, PetServicePrice,
    // PetMonthlyPlan, BoardingRecord) cascade automatically
    prisma.customer.deleteMany({ where: { shopId: id } }),
    prisma.service.deleteMany({ where: { shopId: id } }),
    prisma.monthlyPlan.deleteMany({ where: { shopId: id } }),
    prisma.memberLevel.deleteMany({ where: { shopId: id } }),
    prisma.user.deleteMany({ where: { shopId: id } }),
    prisma.shop.delete({ where: { id } }),
  ])

  return NextResponse.json({ ok: true })
}
