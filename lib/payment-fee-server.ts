// 手續費的伺服器端輔助：載入店家費率、並安全地寫入「平台手續費」支出。
// 與 lib/payment-fee.ts 分開，是因為那支檔案會被 client component 匯入，
// 不能把 prisma 拉進 client bundle。
import { prisma } from "@/lib/prisma"
import {
  parseFeeRates,
  PAYMENT_METHOD_LABELS,
  PLATFORM_FEE_EXPENSE_CATEGORY,
  isPaymentMethod,
  type FeeRates,
} from "@/lib/payment-fee"

export interface FeeContext {
  rates: FeeRates
  /**
   * Expense.createdBy 有 User 外鍵。JWT 內的 userId 可能指向已被刪除的使用者，
   * 直接寫入會噴 FK 錯誤——而手續費支出是在收款交易內建立的，會把整筆收款
   * 一起 rollback。所以先確認使用者仍存在，不存在就記成 null。
   */
  creatorId: string | null
}

/** 一次取得收款當下需要的費率表與可安全寫入的建立者 ID。 */
export async function loadFeeContext(
  shopId: string,
  userId?: string | null
): Promise<FeeContext> {
  const [shop, user] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopId }, select: { paymentFeeRates: true } }),
    userId
      ? prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
      : Promise.resolve(null),
  ])
  return { rates: parseFeeRates(shop?.paymentFeeRates), creatorId: user?.id ?? null }
}

/** prisma client 與 $transaction 回呼裡的 tx 共用的型別。 */
type ExpenseWriter = Pick<typeof prisma, "expense">


/**
 * 手續費 > 0 時寫一筆「平台手續費」支出，供支出／營收報表統計。
 * 呼叫端請在收款成功（狀態已翻為 PAID）之後、同一個 transaction 內呼叫。
 */
export async function recordFeeExpense(
  db: ExpenseWriter,
  opts: {
    shopId: string
    creatorId: string | null
    fee: { feeRate: number; feeAmount: number }
    paymentMethod: string | null | undefined
    /** 來源說明，例如「收款 #a1b2c3」「住宿收款」「儲值充值」 */
    source: string
  }
): Promise<void> {
  if (!(opts.fee.feeAmount > 0)) return
  const label = isPaymentMethod(opts.paymentMethod)
    ? PAYMENT_METHOD_LABELS[opts.paymentMethod]
    : (opts.paymentMethod ?? "")
  await db.expense.create({
    data: {
      shopId: opts.shopId,
      date: new Date(),
      category: PLATFORM_FEE_EXPENSE_CATEGORY,
      description: `${label} 手續費 ${opts.fee.feeRate}%（${opts.source}）`,
      amount: opts.fee.feeAmount,
      createdBy: opts.creatorId,
    },
  })
}
