import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  try {
    const shop = await prisma.shop.update({
      where: { id: session.user.shopId },
      data: {
        logoUrl: body.logoUrl ?? undefined,
        businessHoursStart: body.businessHoursStart ?? undefined,
        businessHoursEnd: body.businessHoursEnd ?? undefined,
      },
    })
    return NextResponse.json(shop)
  } catch (error) {
    console.error("PATCH /api/onboarding/shop", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
