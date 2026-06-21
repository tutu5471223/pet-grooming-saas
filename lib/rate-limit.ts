import { NextResponse } from "next/server"

// Lightweight in-process sliding-window rate limiter.
//
// SCOPE: this is per-instance (in-memory). It is sufficient for a single Render
// web instance, which is the current deployment. If the app is ever scaled to
// multiple instances, back this with a shared store (Upstash/Redis) so limits
// are enforced globally — the public API (check/consume) is intentionally
// shaped so a Redis-backed implementation can be dropped in without touching
// call sites.

interface Bucket {
  hits: number[]
}

const store = new Map<string, Bucket>()
let lastSweep = 0

function sweep(now: number) {
  // Opportunistic cleanup so the map can't grow unbounded.
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, bucket] of store) {
    if (bucket.hits.length === 0 || bucket.hits[bucket.hits.length - 1] < now - 3_600_000) {
      store.delete(key)
    }
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSec: number
}

/**
 * Consume one token for `key` within a sliding window.
 * @param key     stable identifier (e.g. `login:${email}` or `booking:${ip}`)
 * @param limit   max requests allowed per window
 * @param windowMs window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now)
  const cutoff = now - windowMs
  const bucket = store.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => t > cutoff)

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0]
    store.set(key, bucket)
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    }
  }

  bucket.hits.push(now)
  store.set(key, bucket)
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSec: 0 }
}

/** Best-effort client IP from proxy headers (Render / Cloudflare). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

/**
 * Guard helper: returns a 429 NextResponse if the limit is exceeded, else null.
 * Usage: `const limited = enforceRateLimit(`booking:${clientIp(req)}`, 10, 60_000); if (limited) return limited`
 */
export function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const result = rateLimit(key, limit, windowMs)
  if (result.allowed) return null
  return NextResponse.json(
    { error: "請求過於頻繁，請稍後再試", code: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
  )
}
