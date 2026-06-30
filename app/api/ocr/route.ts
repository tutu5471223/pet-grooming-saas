import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { enforceRateLimit } from "@/lib/rate-limit"
import { enforceMaxBody } from "@/lib/validation"

interface VisionResponse {
  responses: Array<{
    fullTextAnnotation?: { text: string }
    textAnnotations?: Array<{ description: string }>
    error?: { message: string; code: number }
  }>
  error?: { message: string; code: number; status: string }
}

// OCR is a paid upstream call — bound per-user and per-shop to control cost/DoS.
const PER_USER_PER_MIN = 20
// Per-shop daily soft cap (see concerns: in-memory, resets on deploy/restart).
const PER_SHOP_PER_DAY = 500
const DAY_MS = 24 * 60 * 60 * 1000

// ~8MB raw image -> base64 inflates ~1.37x. Bound the base64 payload accordingly.
const MAX_BASE64 = Math.ceil(8 * 1024 * 1024 * 1.37)
// M11: overall request-body ceiling (base64 + data-URL prefix + JSON wrapper).
const MAX_BODY_BYTES = MAX_BASE64 + 4096
// M9: bound the paid upstream Vision call so a hung connection can't suspend us.
const VISION_TIMEOUT_MS = 15000

export async function POST(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { userId, shopId } = guard.ctx

  const perUser = enforceRateLimit(`ocr:user:${userId}`, PER_USER_PER_MIN, 60_000)
  if (perUser) return perUser
  const perShop = enforceRateLimit(`ocr:shop:day:${shopId}`, PER_SHOP_PER_DAY, DAY_MS)
  if (perShop) return perShop

  // M11: reject oversized bodies via Content-Length before buffering/parsing.
  const tooLarge = enforceMaxBody(req, MAX_BODY_BYTES)
  if (tooLarge) return tooLarge

  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    console.error("[OCR] GOOGLE_VISION_API_KEY 未設定")
    return NextResponse.json({ error: "OCR 服務暫時無法使用" }, { status: 503 })
  }

  let image: string
  try {
    const body = await req.json() as { image?: unknown }
    if (typeof body.image !== "string") {
      return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 })
    }
    image = body.image
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 })
  }
  if (!image) return NextResponse.json({ error: "Missing image" }, { status: 400 })

  // Strip data URL prefix — Vision API needs raw base64
  const base64 = image.replace(/^data:image\/[a-zA-Z+]+;base64,/, "")

  if (base64.length > MAX_BASE64) {
    return NextResponse.json({ error: "圖片太大，請使用 8MB 以下的圖片" }, { status: 413 })
  }

  let visionRes: Response
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS)
  try {
    visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
              imageContext: {
                languageHints: ["zh-TW", "zh-Hant", "en"],
              },
            },
          ],
        }),
        signal: controller.signal,
      }
    )
  } catch (err) {
    // Keep upstream detail server-side only; return a generic message.
    // M9: an abort (timeout) lands here too and is treated as unavailable.
    console.error("[OCR] fetch 呼叫本身失敗（網路錯誤／逾時）：", err)
    return NextResponse.json({ error: "OCR 服務暫時無法使用" }, { status: 503 })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!visionRes.ok) {
    const errBody = await visionRes.text()
    console.error("[OCR] Vision API 回傳非 2xx：", visionRes.status, errBody)
    return NextResponse.json({ error: "OCR 服務暫時無法使用" }, { status: 503 })
  }

  let visionData: VisionResponse
  try {
    visionData = (await visionRes.json()) as VisionResponse
  } catch (err) {
    console.error("[OCR] 解析 Vision API 回應 JSON 失敗：", err)
    return NextResponse.json({ error: "OCR 服務暫時無法使用" }, { status: 503 })
  }

  // 頂層錯誤（例如 API key 無效時有時放在頂層）
  if (visionData.error) {
    console.error("[OCR] Vision API 頂層錯誤：", visionData.error)
    return NextResponse.json({ error: "OCR 服務暫時無法使用" }, { status: 503 })
  }

  const response = visionData.responses?.[0]

  if (response?.error) {
    console.error("[OCR] Vision response[0] 錯誤：", response.error)
    return NextResponse.json({ error: "OCR 辨識失敗，請更換圖片重試" }, { status: 422 })
  }

  const text =
    response?.fullTextAnnotation?.text ??
    response?.textAnnotations?.[0]?.description ??
    ""

  return NextResponse.json({ text })
}
