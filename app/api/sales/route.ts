import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
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
    const body = await req.json()
    const { customerId, items, note } = body as {
      customerId?: string | null
      note?: string
      items: { productId: string; qty: number; price: number }[]
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "購物車不能為空" }, { status: 400 })
    }
    for (const item of items) {
      if (!item.productId || item.qty < 1 || !Number.isFinite(item.price)) {
        return NextResponse.json({ error: "商品資料有誤" }, { status: 400 })
      }
    }

    // Verify all products belong to this shop
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId },
      select: { id: true, stock: true, name: true },
    })
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "部分商品不存在" }, { status: 400 })
    }

    // Optional: verify customer belongs to shop
    if (customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: customerId, shopId } })
      if (!customer) return NextResponse.json({ error: "找不到此客人" }, { status: 404 })
    }

    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0)

    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          shopId,
          customerId: customerId || null,
          total,
          note: note?.trim() || null,
          items: {
            create: items.map((i) => ({
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

      // Decrement stock for each product
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
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
