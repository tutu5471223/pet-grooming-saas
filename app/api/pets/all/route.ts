// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  // C1: central guard (401 if no shopId / 403 if shop not ACTIVE).
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")?.trim()

  try {
    const pets = await prisma.pet.findMany({
      where: {
        shopId,
        isActive: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { customer: { name: { contains: search } } },
              ],
            }
          : {}),
      },
      include: { customer: { select: { name: true } } },
      orderBy: { name: "asc" },
      // M10: hard cap — search results 20; full list capped at 500 (was unbounded).
      take: search ? 20 : 500,
    })
    return NextResponse.json(pets)
  } catch (error) {
    console.error("GET /api/pets/all", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
