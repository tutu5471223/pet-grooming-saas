// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { checkCustomerLimit } from "@/lib/subscription-guard"
import { readJson, z, shortText, phone } from "@/lib/validation"

// Non-strict: validate the known fields we read, allow extra keys from the UI.
const createCustomerSchema = z.object({
  name: shortText.min(1),
  phone: phone,
  lineId: z.string().trim().max(100).optional().nullable(),
  idNumber: shortText.optional().nullable(),
  address: shortText.min(1),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export async function GET(req: NextRequest) {
  // C1: central guard (401 if no shopId / 403 if shop not ACTIVE).
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { searchParams } = new URL(req.url)
  // Accept both `search` (POS 開單) and `q` (應收下拉) as the search term.
  const search = (searchParams.get("search") ?? searchParams.get("q") ?? "").trim().slice(0, 50)
  // M10: hard pagination cap. `limit` from query, clamped to 1..100 (default 100).
  const limitRaw = Number(searchParams.get("limit"))
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 100

  try {
    const customers = await prisma.customer.findMany({
      where: {
        shopId,
        // L5 + M4: exclude MERGED zombies AND ARCHIVED (soft-deleted) customers
        // from the dropdown/list source.
        status: { notIn: ["MERGED", "ARCHIVED"] },
        OR: search
          ? [
              { name: { contains: search } },
              { phone: { contains: search } },
              { lineId: { contains: search } },
            ]
          : undefined,
      },
      // M10: list-only scalar fields. Heavy detail (pets/contracts/plans/counts)
      // is served by the /api/customers/[id] endpoint, not serialized here.
      select: { id: true, name: true, phone: true, lineId: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return NextResponse.json(customers)
  } catch (error) {
    console.error("GET /api/customers", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // C1: central guard (401/403). checkCustomerLimit below is unchanged.
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const parsed = await readJson(req, createCustomerSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const limitCheck = await checkCustomerLimit(shopId)
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.message }, { status: 403 })
    }

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        phone: body.phone,
        lineId: body.lineId || null,
        idNumber: body.idNumber || null,
        address: body.address || null,
        notes: body.notes || null,
        shopId,
      },
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    // M5: surface the @@unique([shopId, phone]) violation as a friendly 409
    // instead of an opaque 500, so staff see "this phone already has a customer".
    if (error && typeof error === "object" && (error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "此電話號碼已有客戶資料", code: "DUPLICATE_PHONE" },
        { status: 409 }
      )
    }
    console.error("POST /api/customers", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
