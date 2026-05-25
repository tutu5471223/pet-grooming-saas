import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")?.trim().slice(0, 50)
  const category = searchParams.get("category")
  const includeInactive = searchParams.get("includeInactive") === "true"

  try {
    const products = await prisma.product.findMany({
      where: {
        shopId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(category && category !== "ALL" ? { category } : {}),
        ...(search
          ? { OR: [{ name: { contains: search } }, { description: { contains: search } }] }
          : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    })
    return NextResponse.json(products)
  } catch (err) {
    console.error("GET /api/products error:", err)
    return NextResponse.json({ error: "載入失敗，請重試" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    const body = await req.json()
    const { name, category, price, stock, unit, description } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "請填寫商品名稱" }, { status: 400 })
    }
    const priceNum = Number(price)
    const stockNum = Number(stock)
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return NextResponse.json({ error: "請填寫有效售價" }, { status: 400 })
    }
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      return NextResponse.json({ error: "庫存必須為非負整數" }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        shopId,
        name: name.trim(),
        category: category || "GROOMING",
        price: priceNum,
        stock: stockNum,
        unit: unit?.trim() || "個",
        description: description?.trim() || null,
      },
    })
    return NextResponse.json(product, { status: 201 })
  } catch (err) {
    console.error("POST /api/products error:", err)
    return NextResponse.json({ error: "建立失敗，請重試" }, { status: 500 })
  }
}
