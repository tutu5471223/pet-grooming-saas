// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireRole } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { checkStaffLimit } from "@/lib/subscription-guard"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const staff = await prisma.user.findMany({
      where: { shopId: session.user.shopId, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(staff)
  } catch (error) {
    console.error("GET /api/staff", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response

  const { shopId } = guard.ctx

  try {
    const body = await req.json()
    const { name, role } = body
    const email = body.email?.trim() || null
    const password = body.password?.trim() || null

    if (!name?.trim()) {
      return NextResponse.json({ error: "請填寫員工姓名" }, { status: 400 })
    }

    // Email and password must be provided together or not at all
    if (!!email !== !!password) {
      return NextResponse.json(
        { error: "Email 與密碼需同時填寫，或同時留空" },
        { status: 400 }
      )
    }

    const limitCheck = await checkStaffLimit(shopId)
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.message }, { status: 403 })
    }

    let hashedPassword: string | null = null

    if (email && password) {
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return NextResponse.json(
          { error: "密碼至少 8 字元，且須包含英文字母與數字" },
          { status: 400 }
        )
      }
      const existing = await prisma.user.findFirst({ where: { email, shopId } })
      if (existing) {
        return NextResponse.json({ error: "此 Email 在本店已被使用" }, { status: 409 })
      }
      hashedPassword = await bcrypt.hash(password, 10)
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        role: role || "STAFF",
        shopId,
        ...(email ? { email } : {}),
        ...(hashedPassword ? { password: hashedPassword } : {}),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    console.error("POST /api/staff error:", err)
    return NextResponse.json({ error: "新增失敗，請再試一次" }, { status: 500 })
  }
}
