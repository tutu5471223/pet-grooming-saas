// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")?.trim()

  try {
    const pets = await prisma.pet.findMany({
      where: {
        shopId: session.user.shopId,
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
      take: search ? 20 : undefined,
    })
    return NextResponse.json(pets)
  } catch (error) {
    console.error("GET /api/pets/all", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
