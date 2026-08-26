// SECURITY: 多店家隔離 - shopId 由 Session 強制帶入
import { NextRequest, NextResponse } from "next/server"
import { requirePermission, requireRole } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { round2, MAX_MONEY } from "@/lib/money"
import { writeAudit } from "@/lib/audit"
import { startOfMonth, endOfMonth } from "date-fns"

export async function GET(req: NextRequest) {
  // PERM-1: 支出是敏感財務資料。/expenses 頁面已限 OWNER 或有 expenses 權限的
  // 員工，但 API 之前只擋登入，任何店員 curl 一下就能把整間店的支出撈光。
  const guard = await requirePermission("expenses")
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { searchParams } = new URL(req.url)
  const monthParam = searchParams.get("month")

  let where: { shopId: string; date?: { gte: Date; lte: Date } } = { shopId }

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number)
    const monthDate = new Date(y, m - 1, 1)
    where.date = { gte: startOfMonth(monthDate), lte: endOfMonth(monthDate) }
  }

  try {
    const expenses = await prisma.expense.findMany({
      where,
      include: { creator: { select: { name: true } } },
      orderBy: { date: "desc" },
    })

    return NextResponse.json(expenses)
  } catch (error) {
    console.error("GET /api/expenses", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  try {
    const body = await req.json()

    const amount = Number(body.amount)
    if (
      !body.date ||
      !body.category ||
      !body.description ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > MAX_MONEY
    ) {
      return NextResponse.json({ error: "缺少必填欄位或金額無效" }, { status: 400 })
    }
    const expenseDate = new Date(body.date)
    if (Number.isNaN(expenseDate.getTime())) {
      return NextResponse.json({ error: "日期格式錯誤" }, { status: 400 })
    }

    // Verify the user ID from the JWT still exists in the DB (guards against stale sessions)
    const userExists = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
      : null

    const expense = await prisma.expense.create({
      data: {
        shopId,
        date: expenseDate,
        category: String(body.category),
        description: String(body.description),
        amount: round2(amount),
        createdBy: userExists ? userId : null,
      },
      include: { creator: { select: { name: true } } },
    })

    await writeAudit({
      shopId,
      userId,
      action: "expense.create",
      resource: "Expense",
      resourceId: expense.id,
      detail: { amount: expense.amount, category: expense.category },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (err) {
    console.error("POST /api/expenses error:", err)
    return NextResponse.json({ error: "新增失敗，請再試一次" }, { status: 500 })
  }
}
