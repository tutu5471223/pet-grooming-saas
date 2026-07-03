import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { DEFAULT_OCR_KEYWORDS, type OcrKeywords } from "@/lib/ocr-keywords"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "未授權" }, { status: 401 })

  const shop = await prisma.shop.findUnique({
    where: { id: session.user.shopId },
    select: { ocrKeywords: true },
  })

  const keywords: OcrKeywords = { ...DEFAULT_OCR_KEYWORDS }
  if (shop?.ocrKeywords) {
    try {
      const saved = JSON.parse(shop.ocrKeywords) as Partial<OcrKeywords>
      const keys = Object.keys(DEFAULT_OCR_KEYWORDS) as (keyof OcrKeywords)[]
      for (const k of keys) {
        const v = saved[k]
        if (Array.isArray(v) && v.length > 0) keywords[k] = v as string[]
      }
    } catch { /* use defaults on parse error */ }
  }

  return NextResponse.json(keywords)
}
