import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { readJson, shortText, longText, z } from "@/lib/validation"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { id: boardingRecordId } = await params

  try {
    const record = await prisma.boardingRecord.findFirst({ where: { id: boardingRecordId, shopId } })
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const logs = await prisma.boardingDailyLog.findMany({
      where: { boardingRecordId, shopId },
      include: { staff: { select: { name: true } } },
      orderBy: { date: "desc" },
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error("GET /api/boarding/[id]/logs", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

const logSchema = z.object({
  note: longText.nullish(),
  condition: shortText.optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  const { id: boardingRecordId } = await params

  try {
    const parsed = await readJson(req, logSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data

    const record = await prisma.boardingRecord.findFirst({ where: { id: boardingRecordId, shopId } })
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // 先驗證 session user 是否存在於 DB（避免 JWT 過期/重建後 FK 違反）
    const staff = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
      : null

    const log = await prisma.boardingDailyLog.create({
      data: {
        boardingRecordId,
        shopId,
        date: new Date(),
        note: body.note || null,
        condition: body.condition || "良好",
        createdBy: staff ? userId : null,
      },
    })

    return NextResponse.json({ ...log, staff }, { status: 201 })
  } catch (error) {
    console.error("POST /api/boarding/[id]/logs error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
