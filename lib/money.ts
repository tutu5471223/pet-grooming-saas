// Money helpers.
//
// NOTE: monetary columns are currently Prisma `Float` (Postgres double precision).
// Floating point cannot represent every 2-decimal value exactly, so repeated
// read-modify-write arithmetic can drift (e.g. 0.1 + 0.2 !== 0.3). The proper
// long-term fix is to store integer minor units (cents) or Prisma `Decimal`
// (`@db.Decimal(12,2)`). Until that migration is done, every server-side money
// computation MUST be normalised with round2() at the write boundary so values
// persisted to the DB are clean to 2 decimal places.

/** Round to 2 decimal places, killing binary-float drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Hard ceiling for any single money value, guards against overflow / fat-finger. */
export const MAX_MONEY = 100_000_000 // 1 億

/**
 * Coerce + validate an untrusted money value. Returns a finite, non-negative,
 * 2dp-rounded number, or null if the input is not a valid amount.
 */
export function parseMoney(
  input: unknown,
  opts: { min?: number; max?: number; allowZero?: boolean } = {}
): number | null {
  const { min = 0, max = MAX_MONEY, allowZero = true } = opts
  const n = typeof input === "number" ? input : Number(input)
  if (!Number.isFinite(n)) return null
  if (n < min) return null
  if (!allowZero && n === 0) return null
  if (n > max) return null
  return round2(n)
}

/** Sum a list of money values with 2dp normalisation. */
export function sumMoney(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + v, 0))
}
