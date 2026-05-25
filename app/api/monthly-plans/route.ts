import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

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
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const body = await req.json()
  const { name, price, sessions, description } = body

  if (!name?.trim()) return NextResponse.json({ error: "請填寫方案名稱" }, { status: 400 })
  if (typeof price !== "number" || price < 0)
    return NextResponse.json({ error: "請填寫有效月費" }, { status: 400 })
  if (typeof sessions !== "number" || sessions < 0)
    return NextResponse.json({ error: "請填寫有效次數" }, { status: 400 })

  try {
    const plan = await prisma.monthlyPlan.create({
      data: {
        shopId,
        name: name.trim(),
        price,
        sessions,
        description: description?.trim() || null,
        isActive: true,
      },
    })
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error("POST /api/monthly-plans", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
