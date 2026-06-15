import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

interface VisionResponse {
  responses: Array<{
    fullTextAnnotation?: { text: string }
    textAnnotations?: Array<{ description: string }>
    error?: { message: string; code: number }
  }>
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) return NextResponse.json({ error: "OCR 服務未設定" }, { status: 503 })

  let image: string
  try {
    const body = await req.json() as { image: string }
    image = body.image
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 })
  }
  if (!image) return NextResponse.json({ error: "Missing image" }, { status: 400 })

  // Strip data URL prefix — Vision API needs raw base64
  const base64 = image.replace(/^data:image\/[a-zA-Z+]+;base64,/, "")

  const MAX_BASE64 = 7 * 1024 * 1024 // ~5 MB original
  if (base64.length > MAX_BASE64) {
    return NextResponse.json({ error: "圖片太大，請使用 5MB 以下的圖片" }, { status: 413 })
  }

  try {
    const visionRes = await fetch(
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
      }
    )

    if (!visionRes.ok) {
      const errBody = await visionRes.text()
      console.error("Google Vision API error:", visionRes.status, errBody)
      return NextResponse.json({ error: "OCR 服務暫時無法使用，請稍後重試" }, { status: 503 })
    }

    const visionData = (await visionRes.json()) as VisionResponse
    const response = visionData.responses?.[0]

    if (response?.error) {
      console.error("Google Vision response error:", response.error)
      return NextResponse.json({ error: `OCR 辨識失敗：${response.error.message}` }, { status: 422 })
    }

    const text =
      response?.fullTextAnnotation?.text ??
      response?.textAnnotations?.[0]?.description ??
      ""

    return NextResponse.json({ text })
  } catch (err) {
    console.error("Google Vision fetch error:", err)
    return NextResponse.json({ error: "OCR 服務暫時無法使用，請稍後重試" }, { status: 503 })
  }
}
