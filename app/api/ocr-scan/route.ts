// DEPRECATED: 前端已改用 Tesseract.js 在瀏覽器端執行 OCR，此路由保留供未來參考
// SECURITY: 已通過多店家隔離稽核 (2026-05-05)
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { enforceRateLimit } from "@/lib/rate-limit"
import { enforceMaxBody } from "@/lib/validation"
import { z } from "zod"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

// OCR is a paid Anthropic call — bound per-user and per-shop to control cost/DoS.
const PER_USER_PER_MIN = 20
const PER_SHOP_PER_DAY = 500
const DAY_MS = 24 * 60 * 60 * 1000

// ~8MB raw image -> base64 inflates ~1.37x.
const MAX_BASE64 = Math.ceil(8 * 1024 * 1024 * 1.37)
// M11: overall request-body ceiling (base64 + JSON wrapper).
const MAX_BODY_BYTES = MAX_BASE64 + 4096
// M9: bound the paid upstream Anthropic call (and disable retry-multiplying).
const OCR_TIMEOUT_MS = 30000

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const
type AllowedMime = (typeof ALLOWED_MIME)[number]

// Strict schema for the (untrusted) OCR suggestion. Known keys only; bounded
// strings; enums for species/gender. This is a SUGGESTION returned to the
// client to pre-fill a form — never auto-persisted to the DB.
const nullableShort = z.string().max(200).nullable()
const ocrResultSchema = z
  .object({
    customer: z
      .object({
        name: nullableShort,
        phone: z.string().max(40).nullable(),
        lineId: z.string().max(100).nullable(),
        address: z.string().max(300).nullable(),
        note: z.string().max(1000).nullable(),
      })
      .partial(),
    pets: z
      .array(
        z
          .object({
            name: nullableShort,
            species: z.enum(["犬", "貓", "兔", "鳥", "其他"]).nullable(),
            breed: nullableShort,
            gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).nullable(),
            birthday: z.string().max(20).nullable(),
            chipNumber: z.string().max(60).nullable(),
            specialConditions: z.string().max(1000).nullable(),
            allergies: z.string().max(1000).nullable(),
            note: z.string().max(1000).nullable(),
          })
          .partial()
      )
      .max(20),
  })
  .partial()

export async function POST(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { userId, shopId } = guard.ctx

  const perUser = enforceRateLimit(`ocr-scan:user:${userId}`, PER_USER_PER_MIN, 60_000)
  if (perUser) return perUser
  const perShop = enforceRateLimit(`ocr-scan:shop:day:${shopId}`, PER_SHOP_PER_DAY, DAY_MS)
  if (perShop) return perShop

  // M11: reject oversized bodies via Content-Length before buffering/parsing.
  const tooLarge = enforceMaxBody(req, MAX_BODY_BYTES)
  if (tooLarge) return tooLarge

  let image: string, mimeType: string | undefined
  try {
    const body = await req.json() as { image?: unknown; mimeType?: unknown }
    if (typeof body.image !== "string") {
      return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 })
    }
    image = body.image
    mimeType = typeof body.mimeType === "string" ? body.mimeType : undefined
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 })
  }
  if (!image) return NextResponse.json({ error: "Missing image" }, { status: 400 })

  if (image.length > MAX_BASE64) {
    return NextResponse.json({ error: "圖片太大，請使用 8MB 以下的圖片" }, { status: 413 })
  }

  const mediaType: AllowedMime = ALLOWED_MIME.includes(mimeType as AllowedMime)
    ? (mimeType as AllowedMime)
    : "image/jpeg"

  let response
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      // (request options below: M9 timeout)
      system:
        "你是一個寵物美容店的資料辨識助手。請從圖片中辨識客人和寵物的資料，以 JSON 格式回傳。若某欄位看不清楚或不存在請填 null。",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: image,
              },
            },
            {
              type: "text",
              text: `請辨識圖片中的資料，只回傳以下 JSON 格式，不要其他說明：
{
  "customer": {
    "name": "客人姓名或null",
    "phone": "電話或null",
    "lineId": "LINE ID或null",
    "address": "地址或null",
    "note": "備註或null"
  },
  "pets": [
    {
      "name": "寵物名稱或null",
      "species": "物種（犬/貓/兔/鳥/其他）或null",
      "breed": "品種或null",
      "gender": "MALE或FEMALE或UNKNOWN",
      "birthday": "生日yyyy-MM-dd或null",
      "chipNumber": "晶片號碼或null",
      "specialConditions": "特殊疾病或null",
      "allergies": "過敏紀錄或null",
      "note": "備註或null"
    }
  ]
}`,
            },
          ],
        },
      ],
    }, { timeout: OCR_TIMEOUT_MS, maxRetries: 0 })
  } catch (err) {
    console.error("Anthropic API error:", err)
    return NextResponse.json({ error: "OCR 服務暫時無法使用，請稍後重試" }, { status: 503 })
  }

  const text = response.content[0].type === "text" ? response.content[0].text : ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: "無法辨識資料" }, { status: 422 })

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 422 })
  }

  // Validate OCR output against a strict schema before returning it as a
  // suggestion. Unknown/oversized fields are stripped/rejected; treat as
  // untrusted — the caller pre-fills a form, nothing is auto-persisted.
  const validated = ocrResultSchema.safeParse(parsedJson)
  if (!validated.success) {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 422 })
  }

  return NextResponse.json(validated.data)
}
