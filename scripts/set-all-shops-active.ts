/**
 * 將所有 ACTIVE 店家的訂閱設為永久（status=ACTIVE, end=2099-01-01）
 * 在 VPS 上執行：npx tsx scripts/set-all-shops-active.ts
 */
import "dotenv/config"
import { prisma } from "../lib/prisma"

async function main() {
  const farFuture = new Date("2099-01-01")

  // 取得所有 ACTIVE 店家（排除 system）
  const shops = await prisma.shop.findMany({
    where: { status: "ACTIVE", id: { not: "system" } },
    select: { id: true, name: true },
  })
  console.log(`找到 ${shops.length} 家 ACTIVE 店家`)

  for (const shop of shops) {
    const existing = await prisma.subscription.findFirst({
      where: { shopId: shop.id },
      orderBy: { createdAt: "desc" },
    })

    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", currentPeriodEnd: farFuture },
      })
      console.log(`✓ ${shop.name} (${shop.id}) → ACTIVE 到 2099-01-01`)
    } else {
      // 沒有訂閱紀錄，建立一個
      const plan = await prisma.plan.findFirst({ orderBy: { price: "asc" } })
      if (plan) {
        await prisma.subscription.create({
          data: {
            shopId: shop.id,
            planId: plan.id,
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: farFuture,
          },
        })
        console.log(`✓ ${shop.name} (${shop.id}) → 新建 ACTIVE 訂閱`)
      } else {
        console.warn(`✗ ${shop.name} (${shop.id}) → 找不到方案，跳過`)
      }
    }
  }

  console.log("\n完成！所有店家已設為永久訂閱。")
}

main().catch(console.error).finally(() => prisma.$disconnect())
