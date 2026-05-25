import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: boardingRecordId } = await params
  const shopId = session.user.shopId

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: boardingRecordId } = await params
  const shopId = session.user.shopId
  const body = await req.json()

  try {
    const record = await prisma.boardingRecord.findFirst({ where: { id: boardingRecordId, shopId } })
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const log = await prisma.boardingDailyLog.create({
      data: {
        boardingRecordId,
        shopId,
        date: body.date ? new Date(body.date) : new Date(),
        note: body.note || null,
        condition: body.condition || "良好",
        createdBy: session.user.id,
      },
      include: { staff: { select: { name: true } } },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (error) {
    console.error("POST /api/boarding/[id]/logs", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
