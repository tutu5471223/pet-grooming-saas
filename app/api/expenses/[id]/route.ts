// SECURITY: 已通過多店家隔離稽核 (2026-05-22)
import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { round2, MAX_MONEY } from "@/lib/money"
import { writeAudit } from "@/lib/audit"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  const { id } = await params

  let body: { date?: string; category?: string; description?: string; amount?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 })
  }

  try {
    const expense = await prisma.expense.findFirst({ where: { id, shopId } })
    if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 })

    let nextDate = expense.date
    if (body.date !== undefined) {
      const d = new Date(body.date)
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "日期格式錯誤" }, { status: 400 })
      }
      nextDate = d
    }

    let nextAmount = expense.amount
    if (body.amount !== undefined) {
      const a = Number(body.amount)
      if (!Number.isFinite(a) || a < 0 || a > MAX_MONEY) {
        return NextResponse.json({ error: "金額無效" }, { status: 400 })
      }
      nextAmount = round2(a)
    }

    // Scope the write by shopId to prevent cross-tenant id targeting.
    const result = await prisma.expense.updateMany({
      where: { id, shopId },
      data: {
        date: nextDate,
        category: body.category !== undefined ? String(body.category) : expense.category,
        description:
          body.description !== undefined ? String(body.description) : expense.description,
        amount: nextAmount,
      },
    })
    if (result.count !== 1) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const updated = await prisma.expense.findFirst({ where: { id, shopId } })

    await writeAudit({
      shopId,
      userId,
      action: "expense.update",
      resource: "Expense",
      resourceId: id,
      detail: { before: expense.amount, after: nextAmount },
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
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  const { id } = await params

  try {
    const expense = await prisma.expense.findFirst({ where: { id, shopId } })
    if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const result = await prisma.expense.deleteMany({ where: { id, shopId } })
    if (result.count !== 1) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await writeAudit({
      shopId,
      userId,
      action: "expense.delete",
      resource: "Expense",
      resourceId: id,
      detail: { amount: expense.amount, category: expense.category },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/expenses/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
