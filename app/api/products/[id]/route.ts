import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx
  const { id } = await params

  try {
    const product = await prisma.product.findFirst({ where: { id, shopId } })
    if (!product) return NextResponse.json({ error: "找不到商品" }, { status: 404 })
    return NextResponse.json(product)
  } catch (err) {
    console.error("GET /api/products/[id] error:", err)
    return NextResponse.json({ error: "載入失敗，請重試" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx
  const { id } = await params

  try {
    const body = await req.json()

    const existing = await prisma.product.findFirst({ where: { id, shopId } })
    if (!existing) return NextResponse.json({ error: "找不到商品" }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      if (!body.name?.trim()) return NextResponse.json({ error: "請填寫商品名稱" }, { status: 400 })
      data.name = body.name.trim()
    }
    if (body.category !== undefined) data.category = body.category
    if (body.price !== undefined) {
      const p = Number(body.price)
      if (!Number.isFinite(p) || p < 0) return NextResponse.json({ error: "請填寫有效售價" }, { status: 400 })
      data.price = p
    }
    if (body.stock !== undefined) {
      const s = Number(body.stock)
      if (!Number.isInteger(s) || s < 0) return NextResponse.json({ error: "庫存必須為非負整數" }, { status: 400 })
      data.stock = s
    }
    if (body.unit !== undefined) data.unit = body.unit?.trim() || "個"
    if (body.description !== undefined) data.description = body.description?.trim() || null
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

    const updated = await prisma.product.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (err) {
    console.error("PATCH /api/products/[id] error:", err)
    return NextResponse.json({ error: "更新失敗，請重試" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx
  const { id } = await params

  try {
    await prisma.product.updateMany({
      where: { id, shopId },
      data: { isActive: false },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("DELETE /api/products/[id] error:", err)
    return NextResponse.json({ error: "停用失敗，請重試" }, { status: 500 })
  }
}
