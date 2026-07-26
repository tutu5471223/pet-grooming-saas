// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireRole } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { checkStaffLimit } from "@/lib/subscription-guard"
import { writeAudit } from "@/lib/audit"
import { shortText, email as emailSchema, z } from "@/lib/validation"

export async function GET() {
  // C1: central guard (401 if no shopId / 403 if shop not ACTIVE).
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    const staff = await prisma.user.findMany({
      where: { shopId, isActive: true },
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
//
// 前端表單即使欄位留空也會送出空字串 ""（email、password）。空字串必須被視為
// 「未填」而非無效值，否則只填姓名就會被 email/password 驗證擋下（就是這次的
// 「輸入資料格式錯誤」bug）。用 preprocess 把空白字串轉成 undefined。
const emptyToUndefined = (v: unknown) =>
  v == null || (typeof v === "string" && v.trim() === "") ? undefined : v

const staffCreateSchema = z.object({
  name: shortText.min(1, "請填寫員工姓名"),
  // STAFF (櫃台) or GROOMER (美容師) may be created here; OWNER elevation via
  // this endpoint is forbidden (AUTH-7). Unknown role strings are rejected.
  role: z.preprocess(emptyToUndefined, z.enum(["STAFF", "GROOMER"]).optional()),
  email: z.preprocess(emptyToUndefined, emailSchema.optional()),
  password: z.preprocess(emptyToUndefined, z.string().min(8).max(200).optional()),
})

export async function POST(req: NextRequest) {
  // Staff CRUD => OWNER only.
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response

  const { shopId, userId } = guard.ctx

  // 手動解析以便印出收到的資料與驗證錯誤，方便定位是哪個欄位驗證失敗。
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "請求內容不是合法的 JSON" }, { status: 400 })
  }
  console.log("[staff.create] 收到資料：", JSON.stringify(raw))

  const parsedResult = staffCreateSchema.safeParse(raw)
  if (!parsedResult.success) {
    const issues = parsedResult.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }))
    console.log("[staff.create] Zod 驗證失敗：", JSON.stringify(issues))
    const fieldLabels: Record<string, string> = {
      name: "姓名",
      email: "Email",
      password: "密碼",
      role: "角色",
    }
    const first = issues[0]
    const label = first ? fieldLabels[first.path] ?? first.path : ""
    return NextResponse.json(
      {
        error: label ? `「${label}」欄位有誤：${first.message}` : "輸入資料格式錯誤",
        details: issues,
      },
      { status: 400 }
    )
  }
  const body = parsedResult.data

  try {
    const name = body.name.trim()
    const email = body.email?.trim() || null
    const password = body.password?.trim() || null
    // Use the requested role (STAFF/GROOMER only per schema); default STAFF.
    // OWNER is never accepted here — the schema rejects it before we get here.
    const role = body.role ?? "STAFF"

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
