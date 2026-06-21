// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireRole } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { checkStaffLimit } from "@/lib/subscription-guard"
import { writeAudit } from "@/lib/audit"
import { readJson, shortText, email as emailSchema, z } from "@/lib/validation"

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

// AUTH-7: validate role against an explicit allowlist and DISALLOW creating/
// elevating to OWNER via the staff endpoint. Reject unknown role strings.
const staffCreateSchema = z.object({
  name: shortText.min(1, "請填寫員工姓名"),
  // Only STAFF may be created here; OWNER elevation via this endpoint is forbidden.
  role: z.enum(["STAFF"]).optional(),
  email: emailSchema.optional().nullable(),
  password: z.string().min(1).max(200).optional().nullable(),
})

export async function POST(req: NextRequest) {
  // Staff CRUD => OWNER only.
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response

  const { shopId, userId } = guard.ctx

  const parsed = await readJson(req, staffCreateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const name = body.name.trim()
    const email = body.email?.trim() || null
    const password = body.password?.trim() || null
    // Force role to STAFF — never allow OWNER elevation via this endpoint.
    const role = "STAFF"

    if (!name) {
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
        name,
        role,
        shopId,
        ...(email ? { email } : {}),
        ...(hashedPassword ? { password: hashedPassword } : {}),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    })

    await writeAudit({
      shopId,
      userId,
      action: "staff.create",
      resource: "user",
      resourceId: user.id,
      detail: { name, role, hasLogin: !!email },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    console.error("POST /api/staff error:", err)
    return NextResponse.json({ error: "新增失敗，請再試一次" }, { status: 500 })
  }
}
