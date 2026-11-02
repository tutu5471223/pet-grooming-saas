// 營收統計的唯一口徑（M1 淨額口徑），儀表板、報表頁、報表 API 共用，避免各處
// 自己寫 where 條件而分岔（R6-H1：server component 版本曾停留在舊口徑）。
//
//   營收 = Σ amount − Σ refundedAmount，範圍是「原始收款」：
//   - status PAID 或 REFUNDED（全額退款的原單會翻成 REFUNDED，仍要算進來再減掉）
//   - amount >= 0：排除退款流程產生的負數沖銷列，否則退款會被扣兩次
//   - 排除 billingType = MONTHLY_PLAN：那是「包月扣次」，錢在購買整包時已經
//     收過並認列，扣次只是消耗預付次數，再算一次就是重複認列（R6-H2）
import { prisma } from "@/lib/prisma"
import { round2 } from "@/lib/money"

export const REVENUE_PAYMENT_FILTER = {
  status: { in: ["PAID", "REFUNDED"] },
  amount: { gte: 0 },
  billingType: { not: "MONTHLY_PLAN" },
}

export function revenueWhere(shopId: string, from: Date, to: Date) {
  return { shopId, ...REVENUE_PAYMENT_FILTER, paidAt: { gte: from, lte: to } }
}

/** 區間淨營收與筆數。 */
export async function sumNetRevenue(
  shopId: string,
  from: Date,
  to: Date,
  extra: { boardingRecordId?: { not: null } } = {}
): Promise<{ net: number; count: number }> {
  const r = await prisma.payment.aggregate({
    where: { ...revenueWhere(shopId, from, to), ...extra },
    _sum: { amount: true, refundedAmount: true },
    _count: true,
  })
  return {
    net: round2((r._sum.amount ?? 0) - (r._sum.refundedAmount ?? 0)),
    count: r._count,
  }
}
