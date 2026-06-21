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
        subject: `【PetGroomPro】您的店家「${shop.name}」已通過審核！`,
        html: `
          <p>親愛的 ${owner.name}，</p>
          <p>恭喜！您的店家「${shop.name}」已通過審核，您現在可以登入系統開始使用。</p>
          <p>登入資訊：</p>
          <ul>
            <li>店家 ID：<strong>${shop.id}</strong></li>
            <li>Email：${owner.email}</li>
          </ul>
          <p>登入後請完成初始設定（約 2 分鐘）即可開始使用全部功能。</p>
        `,
      })
    } else if (action === "reject") {
      await sendEmail({
        to: owner.email,
        subject: `【PetGroomPro】您的店家申請結果通知`,
        html: `
          <p>親愛的 ${owner.name}，</p>
          <p>很抱歉，您的店家「${shop.name}」申請未通過審核。</p>
          <p>如有疑問請聯絡客服：support@petgrooompro.com</p>
        `,
      })
    } else if (action === "suspend") {
      await sendEmail({
        to: owner.email,
        subject: `【PetGroomPro】您的店家帳號已暫停`,
        html: `
          <p>親愛的 ${owner.name}，</p>
          <p>您的店家「${shop.name}」帳號已被暫停，如有疑問請聯絡客服。</p>
        `,
      })
    }
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
