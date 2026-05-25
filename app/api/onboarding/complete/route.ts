import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await prisma.shop.update({
      where: { id: session.user.shopId },
      data: { onboardingDone: true },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("POST /api/onboarding/complete", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
