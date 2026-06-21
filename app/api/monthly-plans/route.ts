import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireRole } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { readJson, z, shortText } from "@/lib/validation"
import { parseMoney } from "@/lib/money"

const createTemplateSchema = z.object({
  name: shortText,
  price: z.number().finite(),
  sessions: z.number().finite(),
  description: shortText.nullish(),
  validDays: z.number().finite().optional(),
})

export async function GET() {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    const plans = await prisma.monthlyPlan.findMany({
      where: { shopId },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(plans)
  } catch (error) {
    console.error("GET /api/monthly-plans", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // Creating a plan template sets the price (a financial field) → OWNER-only.
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const parsed = await readJson(req, createTemplateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const name = body.name.trim()
  if (!name) return NextResponse.json({ error: "請填寫方案名稱" }, { status: 400 })

  const price = parseMoney(body.price, { allowZero: true })
  if (price === null) return NextResponse.json({ error: "請填寫有效月費" }, { status: 400 })

  const sessions = Math.trunc(body.sessions)
  if (sessions < 0) return NextResponse.json({ error: "請填寫有效次數" }, { status: 400 })

  let validDays: number | undefined
  if (body.validDays !== undefined) {
    validDays = Math.trunc(body.validDays)
    if (validDays < 1) return NextResponse.json({ error: "請填寫有效天數" }, { status: 400 })
  }

  try {
    const plan = await prisma.monthlyPlan.create({
      data: {
        shopId,
        name,
        price,
        sessions,
        description: body.description?.trim() || null,
        isActive: true,
        ...(validDays !== undefined ? { validDays } : {}),
      },
    })
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error("POST /api/monthly-plans", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
