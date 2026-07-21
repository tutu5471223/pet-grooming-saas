/**
 * 將所有 ACTIVE 店家的訂閱設為永久（status=ACTIVE, currentPeriodEnd=2099-01-01），
 * 等同解除方案的客人／寵物／員工數量上限（見 lib/subscription-guard.ts）。
 *
 * 在 VPS 上執行：
 *   cd /var/www/pet-grooming-saas && npx tsx scripts/set-all-shops-active.ts
 *
 * 冪等：重複執行只會把值設成同樣結果，不會產生副作用。
 */
// 必須先載入 env —— lib/prisma 在模組載入當下就會讀 DATABASE_URL 建立連線池
import "./load-env"
import { prisma } from "../lib/prisma"

const FAR_FUTURE = new Date("2099-01-01")

async function main() {
  const shops = await prisma.shop.findMany({
    where: { status: "ACTIVE", id: { not: "system" } },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  })
  console.log(`找到 ${shops.length} 家 ACTIVE 店家\n`)

  let updated = 0
  let created = 0
  let skipped = 0

  for (const shop of shops) {
    const existing = await prisma.subscription.findFirst({
      where: { shopId: shop.id },
      orderBy: { createdAt: "desc" },
    })

    if (existing) {
      const before = `${existing.status} / ${existing.currentPeriodEnd.toISOString().slice(0, 10)}`
      await prisma.subscription.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", currentPeriodEnd: FAR_FUTURE },
      })
      console.log(`✓ ${shop.name} (${shop.id})`)
      console.log(`    ${before}  →  ACTIVE / 2099-01-01`)
      updated++
      continue
    }

    const plan = await prisma.plan.findFirst({ orderBy: { price: "asc" } })
    if (!plan) {
      console.warn(`✗ ${shop.name} (${shop.id}) —— 資料庫沒有任何方案，跳過`)
      skipped++
      continue
    }
    await prisma.subscription.create({
      data: {
        shopId: shop.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: FAR_FUTURE,
      },
    })
    console.log(`✓ ${shop.name} (${shop.id})`)
    console.log(`    （原本沒有訂閱紀錄）  →  新建 ACTIVE / 2099-01-01`)
    created++
  }

  console.log(`\n完成：更新 ${updated} 筆、新建 ${created} 筆、跳過 ${skipped} 筆`)
}

main()
  .catch((e) => {
    console.error("執行失敗：", e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
