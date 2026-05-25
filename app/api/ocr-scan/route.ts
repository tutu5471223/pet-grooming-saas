// DEPRECATED: 前端已改用 Tesseract.js 在瀏覽器端執行 OCR，此路由保留供未來參考
// SECURITY: 已通過多店家隔離稽核 (2026-05-05)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let image: string, mimeType: string | undefined
  try {
    const body = await req.json() as { image: string; mimeType?: string }
    image = body.image
    mimeType = body.mimeType
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 })
  }
  if (!image) return NextResponse.json({ error: "Missing image" }, { status: 400 })

  const MAX_BASE64 = 7 * 1024 * 1024 // ~5MB 原圖 base64 後約 1.37x
  if (image.length > MAX_BASE64) {
    return NextResponse.json({ error: "圖片太大，請使用 5MB 以下的圖片" }, { status: 413 })
  }

  let response
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
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
                media_type: (mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp") || "image/jpeg",
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
    })
  } catch (err) {
    console.error("Anthropic API error:", err)
    return NextResponse.json({ error: "OCR 服務暫時無法使用，請稍後重試" }, { status: 503 })
  }

  const text = response.content[0].type === "text" ? response.content[0].text : ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: "無法辨識資料" }, { status: 422 })

  try {
    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 422 })
  }
}
