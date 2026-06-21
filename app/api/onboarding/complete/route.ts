import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    // shopId derived from session; body is ignored entirely (no mass-assignment).
    await prisma.shop.update({
      where: { id: shopId },
      data: { onboardingDone: true },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("POST /api/onboarding/complete", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
