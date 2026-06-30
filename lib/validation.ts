import { NextResponse } from "next/server"
import { z } from "zod"

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }

/** Default request-body size limit (1 MiB). */
export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024

/**
 * M11: reject oversized request bodies early using the Content-Length header,
 * before buffering/parsing, to bound memory/DoS. Returns a ready-to-return 413
 * response when the declared size exceeds `maxBytes`, else null. A missing or
 * non-numeric Content-Length is allowed through (the body parser still applies
 * its own limits) — this is a cheap fast-path guard, not the only one.
 */
export function enforceMaxBody(
  req: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES
): NextResponse | null {
  const len = req.headers.get("content-length")
  if (len) {
    const n = Number(len)
    if (Number.isFinite(n) && n > maxBytes) {
      return NextResponse.json(
        { error: "請求內容過大", code: "PAYLOAD_TOO_LARGE" },
        { status: 413 }
      )
    }
  }
  return null
}

/**
 * Parse + validate a JSON request body against a Zod schema.
 * Returns a typed, trusted object or a ready-to-return 400 response.
 *
 * Use `.strict()` schemas to reject unexpected keys (prevents mass-assignment).
 *
 * `maxBytes` (optional, default 1 MiB) bounds the request body via Content-Length;
 * signature-class large-payload endpoints can pass a higher limit.
 */
export async function readJson<T>(
  req: Request,
  schema: z.ZodType<T>,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES
): Promise<ValidationResult<T>> {
  const tooLarge = enforceMaxBody(req, maxBytes)
  if (tooLarge) return { ok: false, response: tooLarge }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "請求內容不是合法的 JSON", code: "INVALID_JSON" },
        { status: 400 }
      ),
    }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "輸入資料格式錯誤",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      ),
    }
  }
  return { ok: true, data: parsed.data }
}

/** Validate query params from a URL against a schema. */
export function readQuery<T>(
  url: string,
  schema: z.ZodType<T>
): ValidationResult<T> {
  const params = Object.fromEntries(new URL(url).searchParams.entries())
  const parsed = schema.safeParse(params)
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "查詢參數格式錯誤", code: "VALIDATION_ERROR" },
        { status: 400 }
      ),
    }
  }
  return { ok: true, data: parsed.data }
}

// ── Shared field schemas ────────────────────────────────────────────────
export const MAX_MONEY = 100_000_000

export const money = z.number().finite().nonnegative().max(MAX_MONEY)
export const positiveMoney = z.number().finite().positive().max(MAX_MONEY)
export const positiveInt = z.number().int().positive()
export const nonNegInt = z.number().int().nonnegative()
/** Short free-text field with a sane upper bound (anti-DoS / anti-spam). */
export const shortText = z.string().trim().max(200)
export const longText = z.string().trim().max(5000)
export const phone = z.string().trim().min(3).max(30)
export const email = z.string().trim().email().max(200)

export { z }
