// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"

export async function GET(req: NextRequest) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 50)
  if (!q || q.length < 1) return NextResponse.json({ customers: [], pets: [], appointments: [] })

  try {
    const [customers, pets, appointments] = await Promise.all([
      prisma.customer.findMany({
        where: {
          shopId,
          // Exclude MERGED zombies and ARCHIVED (soft-deleted, M4) customers.
          status: { notIn: ["MERGED", "ARCHIVED"] },
          OR: [{ name: { contains: q } }, { phone: { contains: q } }],
        },
        select: { id: true, name: true, phone: true, flagType: true },
        take: 5,
      }),
      prisma.pet.findMany({
        where: {
          shopId,
          isActive: true,
          OR: [{ name: { contains: q } }, { breed: { contains: q } }],
        },
        select: {
          id: true,
          name: true,
          breed: true,
          species: true,
          customer: { select: { id: true, name: true } },
        },
        take: 5,
      }),
      prisma.appointment.findMany({
        where: {
          shopId,
          pet: { name: { contains: q } },
        },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          type: true,
          pet: { select: { id: true, name: true, customer: { select: { id: true, name: true } } } },
        },
        orderBy: { scheduledAt: "desc" },
        take: 5,
      }),
    ])

    return NextResponse.json({ customers, pets, appointments })
  } catch (error) {
    console.error("GET /api/search", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
