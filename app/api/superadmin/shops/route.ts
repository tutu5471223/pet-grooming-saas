// SECURITY: superadmin-only endpoint
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") || undefined
  const q = searchParams.get("q") || ""

  const shops = await prisma.shop.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q ? { name: { contains: q } } : {}),
      id: { not: "system" }, // exclude the system shop
    },
    include: {
      users: {
        where: { role: "OWNER" },
        select: { name: true, email: true },
        take: 1,
      },
      _count: { select: { customers: true } },
    },
    orderBy: { registeredAt: "desc" },
  })

  return NextResponse.json(shops)
}
