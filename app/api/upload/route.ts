import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { enforceRateLimit, clientIp } from "@/lib/rate-limit"
import { writeFile, mkdir } from "fs/promises"
import { join, resolve, sep } from "path"
import { nanoid } from "nanoid"

const MAX_SIZE = 8 * 1024 * 1024 // 8MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

const UPLOAD_ROOT = resolve(process.cwd(), "public", "uploads")

export async function POST(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  // Bound uploads per user/shop to limit disk/cost abuse.
  const perUser = enforceRateLimit(`upload:user:${userId}`, 30, 60_000)
  if (perUser) return perUser
  const perIp = enforceRateLimit(`upload:ip:${clientIp(req)}`, 60, 60_000)
  if (perIp) return perIp

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "未提供檔案" }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: "檔案為空" }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "檔案大小不可超過 8MB" }, { status: 400 })

  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return NextResponse.json({ error: "僅支援 JPEG、PNG、WebP 格式" }, { status: 400 })

  // Defense-in-depth: shopId comes from the session, but never let any path
  // segment escape the uploads root. Allow only safe identifier characters.
  if (!/^[A-Za-z0-9_-]+$/.test(shopId)) {
    return NextResponse.json({ error: "上傳失敗，請稍後再試" }, { status: 400 })
  }

  try {
    // Generate a random filename — NEVER derive the path from any client input.
    const filename = `${nanoid(12)}.${ext}`
    const uploadDir = join(UPLOAD_ROOT, shopId)
    const destPath = join(uploadDir, filename)

    // Final guard: resolved destination must stay inside the uploads root.
    if (!resolve(destPath).startsWith(UPLOAD_ROOT + sep)) {
      return NextResponse.json({ error: "上傳失敗，請稍後再試" }, { status: 400 })
    }

    await mkdir(uploadDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(destPath, buffer)

    return NextResponse.json({ url: `/uploads/${shopId}/${filename}` }, { status: 201 })
  } catch (error) {
    console.error("POST /api/upload", error)
    return NextResponse.json({ error: "上傳失敗，請稍後再試" }, { status: 500 })
  }
}
