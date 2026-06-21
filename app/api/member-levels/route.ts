// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/auth-guard"
import { readJson, shortText, longText, nonNegInt, z } from "@/lib/validation"

export async function GET() {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    const levels = await prisma.memberLevel.findMany({
      where: { shopId },
      orderBy: { minPoints: "asc" },
    })
    return NextResponse.json(levels)
  } catch (error) {
    console.error("GET /api/member-levels", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

const createSchema = z.object({
  name: shortText.min(1),
  minPoints: nonNegInt.optional(),
  discountRate: z.number().finite().min(0).max(1).optional(),
  benefits: longText.nullish(),
  color: shortText.optional(),
})

export async function POST(req: NextRequest) {
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    const parsed = await readJson(req, createSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data

    const level = await prisma.memberLevel.create({
      data: {
        shopId,
        name: body.name,
        minPoints: body.minPoints ?? 0,
        discountRate: body.discountRate ?? 0,
        benefits: body.benefits || null,
        color: body.color || "#6366f1",
      },
    })
    return NextResponse.json(level, { status: 201 })
  } catch (error) {
    console.error("POST /api/member-levels", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
