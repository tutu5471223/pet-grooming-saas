import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import bcrypt from "bcryptjs"
import { enforceRateLimit, clientIp } from "@/lib/rate-limit"
import { readJson, z, shortText, email as emailSchema } from "@/lib/validation"

const registerSchema = z.object({
  shopName: shortText.min(1),
  ownerName: shortText.min(1),
  phone: z.string().trim().min(1).max(30),
  email: emailSchema,
  password: z.string().min(8).max(200),
  city: shortText.optional(),
  address: shortText.optional(),
  terms: z.boolean().optional(),
})

// Escape user-supplied values before interpolating into notification HTML.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const DEFAULT_CONTRACT_TEMPLATE = `本寵物美容定型化契約（以下稱本契約）由本店與飼主共同簽訂，雙方同意遵守以下條款：

一、服務範圍
本店提供寵物美容、清潔、護理等相關服務，服務內容以當次美容項目為準。

二、飼主聲明事項
1. 飼主聲明其寵物目前身體健康，無傳染性疾病。
2. 飼主已告知本店寵物之特殊健康狀況、過敏史及行為特性。
3. 如寵物有攻擊性行為，飼主應事先告知本店人員。

三、責任範圍
1. 本店將以專業且謹慎之態度提供服務。
2. 寵物在美容過程中如因自身健康因素或突發狀況造成之傷害，本店不承擔責任。
3. 如發現寵物有異常狀況，本店有權停止服務並立即通知飼主。

四、費用說明
服務費用依當日報價為準，飼主同意於服務完成後支付全額費用。

五、同意條款
飼主已詳閱並了解本契約所有條款，同意接受本契約之約束。`

function generateShopId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  const suffix = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  return `shop-${suffix}`
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(`register:${clientIp(req)}`, 5, 60_000)
  if (limited) return limited

  const parsed = await readJson(req, registerSchema)
  if (!parsed.ok) return parsed.response
  const { shopName, ownerName, phone, email, password, city, address, terms } = parsed.data

  if (!terms) {
    return NextResponse.json({ error: "請同意服務條款" }, { status: 400 })
  }

  try {
    const existingUser = await prisma.user.findFirst({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: "此 Email 已被使用" }, { status: 409 })
    }

    // Generate unique shopId
    let shopId = generateShopId()
    while (await prisma.shop.findUnique({ where: { id: shopId } })) {
      shopId = generateShopId()
    }

    const hashed = await bcrypt.hash(password, 10)
    const trialPlan = await prisma.plan.findFirst({ where: { price: 0, isActive: true } })
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)

    await prisma.$transaction(async (tx) => {
      await tx.shop.create({
        data: {
          id: shopId,
          name: shopName,
          phone: phone || null,
          address: address || null,
          city: city || null,
          contractTemplate: DEFAULT_CONTRACT_TEMPLATE,
          status: "PENDING",
          onboardingDone: false,
        },
      })
      await tx.user.create({
        data: {
          name: ownerName,
          email,
          password: hashed,
          role: "OWNER",
          shopId,
          isActive: true,
        },
      })
      if (trialPlan) {
        await tx.subscription.create({
          data: {
            shopId,
            planId: trialPlan.id,
            status: "TRIAL",
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEnd,
          },
        })
      }
      await tx.service.createMany({
        data: [
          { shopId, name: "全套美容", category: "美容", price: 1200, isActive: true },
          { shopId, name: "基礎洗澡", category: "洗澡", price: 600, isActive: true },
          { shopId, name: "指甲修剪", category: "美容", price: 200, isActive: true },
        ],
      })
      await tx.boardingRoom.createMany({
        data: [
          { shopId, name: "1號房", dailyRate: 800 },
          { shopId, name: "2號房", dailyRate: 800 },
          { shopId, name: "3號房", dailyRate: 800 },
        ],
      })
    })

    // Notify superadmin
    const appliedAt = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
    const adminEmail = process.env.SUPERADMIN_EMAIL ?? "tutu5471223@gmail.com"
    await sendEmail({
      to: adminEmail,
      subject: "【PetOS71】新店家申請通知",
      html: `
        <p>有新店家申請註冊，請前往超級管理後台審核。</p>
        <table cellpadding="6" style="border-collapse:collapse">
          <tr><td style="color:#555">店家名稱</td><td><strong>${escapeHtml(shopName)}</strong></td></tr>
          <tr><td style="color:#555">負責人</td><td>${escapeHtml(ownerName)}</td></tr>
          <tr><td style="color:#555">電話</td><td>${escapeHtml(phone)}</td></tr>
          <tr><td style="color:#555">Email</td><td>${escapeHtml(email)}</td></tr>
          <tr><td style="color:#555">申請時間</td><td>${escapeHtml(appliedAt)}</td></tr>
          <tr><td style="color:#555">店家 ID</td><td style="font-family:monospace">${escapeHtml(shopId)}</td></tr>
        </table>
        <p style="margin-top:16px">
          <a href="https://petos71.com/admin/shops/${escapeHtml(shopId)}" style="color:#4f46e5">前往審核頁面</a>
        </p>
      `,
    })

    return NextResponse.json({ ok: true, shopId }, { status: 201 })
  } catch (error) {
    console.error("POST /api/register", error)
    return NextResponse.json({ error: "註冊失敗，請稍後再試" }, { status: 500 })
  }
}
