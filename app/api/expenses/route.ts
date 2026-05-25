// SECURITY: 多店家隔離 - shopId 由 Session 強制帶入
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth } from "date-fns"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
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
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId

  try {
    const body = await req.json()

    const amount = Number(body.amount)
    if (!body.date || !body.category || !body.description || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "缺少必填欄位或金額無效" }, { status: 400 })
    }

    // Verify the user ID from the JWT still exists in the DB (guards against stale sessions)
    const userExists = session.user.id
      ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } })
      : null

    const expense = await prisma.expense.create({
      data: {
        shopId,
        date: new Date(body.date),
        category: body.category,
        description: body.description,
        amount,
        createdBy: userExists ? session.user.id : null,
      },
      include: { creator: { select: { name: true } } },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (err) {
    console.error("POST /api/expenses error:", err)
    return NextResponse.json({ error: "新增失敗，請再試一次" }, { status: 500 })
  }
}
