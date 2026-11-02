import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { readJson, shortText, z } from "@/lib/validation"

// Mass-assignment guard: the user can ONLY set the explicitly-picked display
// fields below. shopId is derived from the session (never the body), and the
// user can never set role / isSuperAdmin / arbitrary shop columns from input.
const onboardingShopSchema = z.object({
  logoUrl: shortText.max(1000).optional().nullable(),
  businessHoursStart: shortText.optional().nullable(),
  businessHoursEnd: shortText.optional().nullable(),
})

export async function PATCH(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const parsed = await readJson(req, onboardingShopSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: {
        logoUrl: body.logoUrl ?? undefined,
        businessHoursStart: body.businessHoursStart ?? undefined,
        businessHoursEnd: body.businessHoursEnd ?? undefined,
      },
      // R6-H8: 只回傳本頁會用到的欄位；整筆 shop 會帶出 LINE 密鑰與權杖，
      // 而這支 API 任何店員都能呼叫。
      select: { id: true, name: true, logoUrl: true, businessHoursStart: true, businessHoursEnd: true },
    })
    return NextResponse.json(shop)
  } catch (error) {
    console.error("PATCH /api/onboarding/shop", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
