// 每日執行的訂閱到期生命週期處理：
//   1. 訂閱到期 → 進入 3 天緩衝期，緩衝期開始時寄一次續約提醒 Email 給店家
//   2. 緩衝期（3 天）結束仍未續約 → 店家狀態設為 SUSPENDED（停用），記錄 suspendedAt
//   3. 停用滿 90 天仍未續約 → 標記 dataPurgeMarkedAt（僅標記待清除，不做實際刪除）
//   4. 續約/永久（到期日回到未來）→ 解除停權與待清除標記（backstop；超管 action 也會即時解除）
//
// 續約的判定看「最新訂閱的 currentPeriodEnd 是否回到未來」，因此不論是超管延長試用、
// 設永久、設到期日，或未來接上金流自動續費，這裡都會一致處理。
import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

const GRACE_DAYS = 3
const RETAIN_DAYS = 90
// 到期日超過此門檻視為「永久訂閱」，不進入到期流程。
const PERMANENT_THRESHOLD = new Date("2090-01-01")

function authorizeCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error("[CRON/subscription-lifecycle] CRON_SECRET 未設定，拒絕執行")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }
  const authHeader = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// 台北時區的日期字串 "yyyy-MM-dd"，用來以「日曆日」為單位比較到期，
// 避免受「當天 23:59 到期」與 cron 執行時刻的精確時間差影響（選項 B）。
function taipeiDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(d)
}

const RENEW_EMAIL = (shopName: string, expiry: Date, graceEnd: Date) => `
  <p>您好，「${shopName}」：</p>
  <p>您的 PetOS71 訂閱已於 <strong>${expiry.toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })}</strong> 到期。</p>
  <p>目前提供 <strong>${GRACE_DAYS} 天緩衝期</strong>，若於 <strong>${graceEnd.toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })}</strong> 前完成續約，服務將不中斷。</p>
  <p>逾期未續約，帳號將暫時停用（資料仍會保留一段時間，續約即可恢復）。</p>
  <p>
    <a href="https://petos71.com/login" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">前往續約</a>
  </p>
`

export async function GET(req: NextRequest) {
  const denied = authorizeCron(req)
  if (denied) return denied

  const now = new Date()
  let remindersSent = 0, suspended = 0, purgeMarked = 0, reactivated = 0

  // 撈所有店家 + 其最新一筆訂閱（排除系統管理店）。
  const shops = await prisma.shop.findMany({
    where: { id: { not: "system" } },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      suspendedAt: true,
      dataPurgeMarkedAt: true,
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, currentPeriodEnd: true, graceReminderSentAt: true },
      },
    },
  })

  for (const shop of shops) {
    const sub = shop.subscriptions[0]
    if (!sub) continue // 沒有訂閱紀錄的店家不納入到期處理

    const expiry = sub.currentPeriodEnd
    const graceEndDate = addDays(expiry, GRACE_DAYS)
    const isPermanent = sub.status === "ACTIVE" && expiry >= PERMANENT_THRESHOLD
    // 選項 B：以台北「日期」為準——到期日當天即視為到期並進入緩衝期。
    const todayStr = taipeiDateStr(now)
    const expiryStr = taipeiDateStr(expiry)
    const graceEndStr = taipeiDateStr(graceEndDate)
    const stillValid = isPermanent || todayStr < expiryStr

    // ── 有效（永久或未到期）：若店家先前被停權/標記，恢復之（backstop）──
    if (stillValid) {
      const needsReactivate =
        shop.status === "SUSPENDED" || shop.suspendedAt || shop.dataPurgeMarkedAt || sub.graceReminderSentAt
      if (needsReactivate) {
        await prisma.shop.update({
          where: { id: shop.id },
          data: {
            ...(shop.status === "SUSPENDED" ? { status: "ACTIVE" } : {}),
            suspendedAt: null,
            dataPurgeMarkedAt: null,
          },
        })
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { graceReminderSentAt: null },
        })
        reactivated++
      }
      continue
    }

    // ── 已到期（今天 ≥ 到期日，以台北日期計）──
    if (todayStr < graceEndStr) {
      // 緩衝期內（到期日 ≤ 今天 < 到期日+3天）：寄一次續約提醒（冪等，靠 graceReminderSentAt）
      if (!sub.graceReminderSentAt) {
        if (shop.email) {
          try {
            await sendEmail({
              to: shop.email,
              subject: "【PetOS71】您的訂閱已到期，請儘快續約",
              html: RENEW_EMAIL(shop.name, expiry, graceEndDate),
            })
          } catch (e) {
            console.error(`[CRON/subscription-lifecycle] 寄信失敗 shopId=${shop.id}`, e)
          }
        }
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { graceReminderSentAt: now },
        })
        remindersSent++
      }
      continue
    }

    // ── 緩衝期已過 ──
    if (shop.status !== "SUSPENDED") {
      // 停用店家
      await prisma.shop.update({
        where: { id: shop.id },
        data: { status: "SUSPENDED", suspendedAt: shop.suspendedAt ?? now },
      })
      suspended++
      continue
    }

    // ── 已停用：檢查 90 天保留期是否已滿 ──
    const suspendedAt = shop.suspendedAt ?? now
    if (now >= addDays(suspendedAt, RETAIN_DAYS) && !shop.dataPurgeMarkedAt) {
      // 僅標記待清除，不做實際刪除（實刪需另外謹慎處理）
      await prisma.shop.update({
        where: { id: shop.id },
        data: { dataPurgeMarkedAt: now },
      })
      purgeMarked++
    }
  }

  console.log(`[CRON/subscription-lifecycle] 提醒=${remindersSent} 停用=${suspended} 標記待清=${purgeMarked} 恢復=${reactivated}`)
  return NextResponse.json({ ok: true, remindersSent, suspended, purgeMarked, reactivated })
}
