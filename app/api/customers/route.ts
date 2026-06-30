// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { checkCustomerLimit } from "@/lib/subscription-guard"
import { readJson, z, shortText, phone } from "@/lib/validation"

// Non-strict: validate the known fields we read, allow extra keys from the UI.
const createCustomerSchema = z.object({
  name: shortText.min(1),
  phone: phone,
  lineId: z.string().trim().max(100).optional().nullable(),
  idNumber: shortText.optional().nullable(),
  address: shortText.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const { searchParams } = new URL(req.url)
  const search = (searchParams.get("search") ?? "").trim().slice(0, 50)

  try {
    const customers = await prisma.customer.findMany({
      where: {
        shopId,
        OR: search
          ? [
              { name: { contains: search } },
              { phone: { contains: search } },
              { lineId: { contains: search } },
            ]
          : undefined,
      },
      include: {
        memberLevel: true,
        monthlyPlan: true,
        pets: {
          where: { isActive: true },
          include: { contract: true, groomingRecords: { orderBy: { date: "desc" }, take: 1 } },
        },
        _count: { select: { pets: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(customers)
  } catch (error) {
    console.error("GET /api/customers", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId

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
    console.error("POST /api/customers", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
