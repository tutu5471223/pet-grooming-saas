// 付款方式手續費：店家為每種付款方式設定費率(%)，收款當下依付款方式計算
// 手續費與實收淨額，並快照到 Payment。
import { round2 } from "@/lib/money"

export const PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER", "LINE_PAY"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "現金",
  CARD: "刷卡",
  TRANSFER: "轉帳",
  LINE_PAY: "LINE Pay",
}

export type FeeRates = Record<PaymentMethod, number>

export const DEFAULT_FEE_RATES: FeeRates = { CASH: 0, CARD: 0, TRANSFER: 0, LINE_PAY: 0 }

/** 費率夾在 0~100(%)，非法值視為 0。 */
function clampRate(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(round2(n), 100)
}

/** 解析 Shop.paymentFeeRates（JSON 字串）為完整費率表，缺項補 0。 */
export function parseFeeRates(raw: string | null | undefined): FeeRates {
  if (!raw) return { ...DEFAULT_FEE_RATES }
  try {
    const p = JSON.parse(raw) as Partial<Record<string, unknown>>
    return {
      CASH: clampRate(p.CASH),
      CARD: clampRate(p.CARD),
      TRANSFER: clampRate(p.TRANSFER),
      LINE_PAY: clampRate(p.LINE_PAY),
    }
  } catch {
    return { ...DEFAULT_FEE_RATES }
  }
}

/** 驗證並正規化前端送來的費率物件（只留合法欄位、夾在 0~100）。 */
export function normalizeFeeRates(input: unknown): FeeRates {
  if (!input || typeof input !== "object") return { ...DEFAULT_FEE_RATES }
  const p = input as Record<string, unknown>
  return {
    CASH: clampRate(p.CASH),
    CARD: clampRate(p.CARD),
    TRANSFER: clampRate(p.TRANSFER),
    LINE_PAY: clampRate(p.LINE_PAY),
  }
}

/**
 * 計算某筆收款的手續費快照。只有實際外部收款方式（CASH/CARD/TRANSFER/LINE_PAY）
 * 才依費率計費；儲值扣抵、包月扣次等內部沖抵無 paymentMethod，費率視為 0。
 */
export function computeFee(
  amount: number,
  paymentMethod: string | null | undefined,
  rates: FeeRates
): { feeRate: number; feeAmount: number; netAmount: number } {
  const rate =
    paymentMethod && (paymentMethod as PaymentMethod) in rates
      ? rates[paymentMethod as PaymentMethod]
      : 0
  const base = round2(amount)
  const feeAmount = round2((base * rate) / 100)
  const netAmount = round2(base - feeAmount)
  return { feeRate: rate, feeAmount, netAmount }
}

export const PLATFORM_FEE_EXPENSE_CATEGORY = "平台手續費"
