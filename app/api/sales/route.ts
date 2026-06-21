import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { readJson, z, positiveInt } from "@/lib/validation"
import { round2, sumMoney } from "@/lib/money"
import { startOfDay, endOfDay, parseISO } from "date-fns"

export async function GET(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get("date")

  try {
    let createdAt: { gte: Date; lte: Date } | undefined
    if (dateStr) {
      const d = parseISO(dateStr)
      createdAt = { gte: startOfDay(d), lte: endOfDay(d) }
    }

    const sales = await prisma.sale.findMany({
      where: { shopId, ...(createdAt ? { createdAt } : {}) },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          include: { product: { select: { id: true, name: true, unit: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
    return NextResponse.json(sales)
  } catch (err) {
    console.error("GET /api/sales error:", err)
    return NextResponse.json({ error: "載入失敗，請重試" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    // NON-strict schema: validate known fields' types/bounds, allow extra keys.
    // `price` is accepted but treated only as a display hint — never trusted.
    const schema = z.object({
      customerId: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
      items: z
        .array(
          z.object({
            productId: z.string().min(1),
            qty: positiveInt,
            price: z.number().optional(),
          })
        )
        .min(1, "購物車不能為空"),
    })
    const parsed = await readJson(req, schema)
    if (!parsed.ok) return parsed.response
    const { customerId, items, note } = parsed.data

    // Verify all products belong to this shop (also yields authoritative prices)
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId },
      select: { id: true, stock: true, name: true, price: true },
    })
    if (products.length !== new Set(productIds).size) {
      return NextResponse.json({ error: "部分商品不存在" }, { status: 400 })
    }
    const priceById = new Map(products.map((p) => [p.id, p.price]))

    // Optional: verify customer belongs to shop
    if (customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: customerId, shopId } })
      if (!customer) return NextResponse.json({ error: "找不到此客人" }, { status: 404 })
    }

    // Recompute every line price server-side from authoritative Product.price.
    // Client-supplied price is ignored entirely.
    const lineItems = items.map((i) => {
      const unitPrice = round2(priceById.get(i.productId) ?? 0)
      return {
        productId: i.productId,
        qty: i.qty,
        price: unitPrice,
        lineTotal: round2(unitPrice * i.qty),
      }
    })
    const total = sumMoney(lineItems.map((l) => l.lineTotal))

    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          shopId,
          customerId: customerId || null,
          total,
          note: note?.trim() || null,
          items: {
            create: lineItems.map((i) => ({
              productId: i.productId,
              qty: i.qty,
              price: i.price,
            })),
          },
        },
        include: {
          items: { include: { product: { select: { name: true, unit: true } } } },
          customer: { select: { id: true, name: true } },
        },
      })

      // Decrement stock for each product (scoped by shopId)
      for (const item of lineItems) {
        await tx.product.updateMany({
          where: { id: item.productId, shopId },
          data: { stock: { decrement: item.qty } },
        })
      }

      return newSale
    })

    return NextResponse.json(sale, { status: 201 })
  } catch (err) {
    console.error("POST /api/sales error:", err)
    return NextResponse.json({ error: "結帳失敗，請重試" }, { status: 500 })
  }
}
