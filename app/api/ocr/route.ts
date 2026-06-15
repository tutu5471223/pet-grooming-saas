import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

interface VisionResponse {
  responses: Array<{
    fullTextAnnotation?: { text: string }
    textAnnotations?: Array<{ description: string }>
    error?: { message: string; code: number }
  }>
  error?: { message: string; code: number; status: string }
}

export async function POST(req: NextRequest) {
  console.log("[OCR] 收到請求")

  const session = await auth()
  if (!session) {
    console.error("[OCR] 未授權：session 為空")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY
  console.log("[OCR] API Key 狀態：", apiKey ? `已設定（長度 ${apiKey.length}）` : "未設定（undefined）")
  if (!apiKey) {
    return NextResponse.json({ error: "OCR 服務未設定：缺少 GOOGLE_VISION_API_KEY 環境變數" }, { status: 503 })
  }

  let image: string
  try {
    const body = await req.json() as { image: string }
    image = body.image
    console.log("[OCR] 圖片接收：", image ? `base64 長度 ${image.length}` : "未提供")
  } catch (e) {
    console.error("[OCR] 解析請求 body 失敗：", e)
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 })
  }
  if (!image) return NextResponse.json({ error: "Missing image" }, { status: 400 })

  // Strip data URL prefix — Vision API needs raw base64
  const base64 = image.replace(/^data:image\/[a-zA-Z+]+;base64,/, "")
  console.log("[OCR] 去除 data URL 後 base64 長度：", base64.length)

  const MAX_BASE64 = 7 * 1024 * 1024
  if (base64.length > MAX_BASE64) {
    return NextResponse.json({ error: "圖片太大，請使用 5MB 以下的圖片" }, { status: 413 })
  }

  let visionRes: Response
  try {
    console.log("[OCR] 呼叫 Google Vision API...")
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
      }
    )
    console.log("[OCR] Vision API HTTP 狀態：", visionRes.status)
  } catch (err) {
    console.error("[OCR] fetch 呼叫本身失敗（網路錯誤）：", err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `OCR 網路錯誤：${msg}` }, { status: 503 })
  }

  if (!visionRes.ok) {
    const errBody = await visionRes.text()
    console.error("[OCR] Vision API 回傳非 2xx：", visionRes.status, errBody)
    // 嘗試解析 Google 的錯誤訊息
    let detail = errBody
    try {
      const parsed = JSON.parse(errBody) as { error?: { message?: string; status?: string } }
      if (parsed.error?.message) detail = `${parsed.error.status ?? ""} ${parsed.error.message}`.trim()
    } catch { /* 非 JSON，直接用原始文字 */ }
    return NextResponse.json(
      { error: `Google Vision API 錯誤 ${visionRes.status}：${detail}` },
      { status: 503 }
    )
  }

  let visionData: VisionResponse
  try {
    visionData = (await visionRes.json()) as VisionResponse
    console.log("[OCR] Vision API 回應 keys：", Object.keys(visionData))
  } catch (err) {
    console.error("[OCR] 解析 Vision API 回應 JSON 失敗：", err)
    return NextResponse.json({ error: "OCR 回應格式錯誤" }, { status: 503 })
  }

  // 頂層錯誤（例如 API key 無效時有時放在頂層）
  if (visionData.error) {
    console.error("[OCR] Vision API 頂層錯誤：", visionData.error)
    return NextResponse.json(
      { error: `Google Vision 錯誤：${visionData.error.status ?? ""} ${visionData.error.message}`.trim() },
      { status: 422 }
    )
  }

  const response = visionData.responses?.[0]
  console.log("[OCR] responses[0] keys：", response ? Object.keys(response) : "undefined")

  if (response?.error) {
    console.error("[OCR] Vision response[0] 錯誤：", response.error)
    return NextResponse.json(
      { error: `OCR 辨識失敗（code ${response.error.code}）：${response.error.message}` },
      { status: 422 }
    )
  }

  const text =
    response?.fullTextAnnotation?.text ??
    response?.textAnnotations?.[0]?.description ??
    ""

  console.log("[OCR] 辨識完成，文字長度：", text.length)
  return NextResponse.json({ text })
}
