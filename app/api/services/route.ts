// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { readJson, money, shortText, longText, positiveInt, z } from "@/lib/validation"
import { round2 } from "@/lib/money"

export async function GET() {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    const services = await prisma.service.findMany({
      where: { shopId, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    })
    return NextResponse.json(services)
  } catch (error) {
    console.error("GET /api/services", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

const createSchema = z.object({
  name: shortText.min(1),
  category: shortText.nullish(),
  price: money.optional(),
  duration: positiveInt.nullish(),
  description: longText.nullish(),
})

export async function POST(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    const parsed = await readJson(req, createSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data

    const service = await prisma.service.create({
      data: {
        shopId,
        name: body.name,
        category: body.category || null,
        price: round2(body.price ?? 0),
        duration: body.duration ?? null,
        description: body.description || null,
      },
    })
    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    console.error("POST /api/services", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
