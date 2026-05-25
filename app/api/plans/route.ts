import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response

  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    })
    return NextResponse.json(plans)
  } catch (error) {
    console.error("GET /api/plans", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
