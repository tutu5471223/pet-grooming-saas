import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { nanoid } from "nanoid"

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "未提供檔案" }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "檔案大小不可超過 5MB" }, { status: 400 })

  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return NextResponse.json({ error: "僅支援 JPEG、PNG、WebP 格式" }, { status: 400 })

  try {
    const filename = `${nanoid(12)}.${ext}`
    const uploadDir = join(process.cwd(), "public", "uploads", shopId)
    await mkdir(uploadDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(uploadDir, filename), buffer)

    return NextResponse.json({ url: `/uploads/${shopId}/${filename}` }, { status: 201 })
  } catch (error) {
    console.error("POST /api/upload", error)
    return NextResponse.json({ error: "上傳失敗，請稍後再試" }, { status: 500 })
  }
}
