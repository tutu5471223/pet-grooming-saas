// SECURITY: 已通過多店家隔離稽核 (2026-05-22)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId

  let body: { date?: string; category?: string; description?: string; amount?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 })
  }

  try {
    const expense = await prisma.expense.findFirst({ where: { id, shopId } })
    if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        date: body.date ? new Date(body.date) : expense.date,
        category: body.category ?? expense.category,
        description: body.description ?? expense.description,
        amount: body.amount ?? expense.amount,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/expenses/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId

  try {
    const expense = await prisma.expense.findFirst({ where: { id, shopId } })
    if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.expense.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/expenses/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
