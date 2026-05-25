// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const shopId = session.user.shopId

  try {
    const [levels, customers] = await Promise.all([
      prisma.memberLevel.findMany({ where: { shopId }, orderBy: { minPoints: "desc" } }),
      prisma.customer.findMany({
        where: { shopId, status: "ACTIVE" },
        select: { id: true, points: true, memberLevelId: true },
      }),
    ])

    let upgraded = 0
    let downgraded = 0

    for (const customer of customers) {
      const qualifying = levels.find((l) => l.minPoints <= customer.points) ?? null
      const newLevelId = qualifying?.id ?? null
      if (newLevelId !== customer.memberLevelId) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { memberLevelId: newLevelId },
        })
        if (newLevelId && (!customer.memberLevelId || (qualifying && levels.findIndex(l => l.id === newLevelId) < levels.findIndex(l => l.id === customer.memberLevelId)))) {
          upgraded++
        } else {
          downgraded++
        }
      }
    }

    await writeAudit({
      shopId,
      userId: session.user.id,
      action: "SYNC_MEMBER_TIERS",
      resource: "MemberLevel",
      detail: { upgraded, downgraded, total: customers.length },
    })

    return NextResponse.json({ success: true, upgraded, downgraded, total: customers.length })
  } catch (error) {
    console.error("POST /api/member-levels/sync", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
