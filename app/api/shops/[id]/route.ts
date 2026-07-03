// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { requireRole, assertShopOwnership } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { sanitizeContractHtml } from "@/lib/sanitize"
import { writeAudit } from "@/lib/audit"
import { readJson, shortText, longText, z } from "@/lib/validation"

// Non-strict: validate the known editable fields; extra keys are ignored and
// only the explicitly-picked fields below are ever written to the DB.
const shopUpdateSchema = z.object({
  name: shortText.optional(),
  phone: shortText.optional().nullable(),
  address: shortText.max(500).optional().nullable(),
  lineId: shortText.optional().nullable(),
  email: shortText.optional().nullable(),
  logoUrl: shortText.max(1000).optional().nullable(),
  businessHoursStart: shortText.optional().nullable(),
  businessHoursEnd: shortText.optional().nullable(),
  restDays: z.array(z.union([z.number(), z.string()])).optional(),
  reminderTemplate: longText.optional().nullable(),
  contractTemplate: longText.optional().nullable(),
  lineChannelToken: shortText.max(1000).optional().nullable(),
  ocrKeywords: longText.optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  const { id } = await params
  // Ensure shop belongs to this session
  const ownership = assertShopOwnership(shopId, id)
  if (ownership) return ownership

  const parsed = await readJson(req, shopUpdateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    // XSS-1: sanitize shop-authored contract HTML before storing (rendered on
    // public pages via dangerouslySetInnerHTML).
    const contractTemplate =
      body.contractTemplate !== undefined && body.contractTemplate !== null
        ? sanitizeContractHtml(body.contractTemplate)
        : undefined

    const shop = await prisma.shop.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        phone: body.phone ?? undefined,
        address: body.address ?? undefined,
        lineId: body.lineId ?? undefined,
        email: body.email ?? undefined,
        logoUrl: body.logoUrl ?? undefined,
        businessHoursStart: body.businessHoursStart ?? undefined,
        businessHoursEnd: body.businessHoursEnd ?? undefined,
        restDays: body.restDays !== undefined ? JSON.stringify(body.restDays) : undefined,
        reminderTemplate: body.reminderTemplate ?? undefined,
        contractTemplate,
        lineChannelToken:
          body.lineChannelToken !== undefined ? (body.lineChannelToken ?? null) : undefined,
        ocrKeywords:
          body.ocrKeywords !== undefined ? (body.ocrKeywords ?? null) : undefined,
      },
    })

    await writeAudit({
      shopId,
      userId,
      action: "shop.update",
      resource: "shop",
      resourceId: id,
    })

    return NextResponse.json(shop)
  } catch (error) {
    console.error("PATCH /api/shops/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
