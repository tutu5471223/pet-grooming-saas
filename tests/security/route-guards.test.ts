// Handler-level security tests.
//
// Unlike the old multi-tenant test (which re-implemented queries against a real
// SQLite file and never touched a route), these import the ACTUAL route
// handlers and invoke them with a mocked session (@/auth) and a mocked Prisma
// client (@/lib/prisma). They fail if a route drops its auth/role guard, its
// input validation, or its shopId scoping — i.e. they test the real security
// invariants. (CQ-3 / TEST-1 / TEST-3)

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks (hoisted above imports by vitest) ────────────────────────────
vi.mock("@/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => {
  const model = () => ({
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: "new" }),
    update: vi.fn().mockResolvedValue({ id: "x" }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    delete: vi.fn().mockResolvedValue({ id: "x" }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _sum: {} }),
  })
  const prisma: any = {
    customer: model(), payment: model(), pet: model(), expense: model(),
    pointsHistory: model(), storedValueHistory: model(), auditLog: model(),
    user: model(), groomingRecord: model(), petMonthlyPlan: model(),
    receivable: model(), service: model(), product: model(),
  }
  prisma.$transaction = vi.fn(async (arg: any) =>
    typeof arg === "function" ? arg(prisma) : Promise.all(arg)
  )
  return { prisma }
})

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const mockAuth = auth as unknown as Mock
const db = prisma as any

const SHOP_A = "shop-A"
function session(role: string, shopId = SHOP_A, extra: Record<string, unknown> = {}) {
  return { user: { id: "u1", name: "T", email: "t@x.com", role, shopId, isSuperAdmin: false, ...extra } }
}
function jsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) })

beforeEach(() => {
  vi.clearAllMocks()
  // reset default resolved values cleared by clearAllMocks
  for (const m of Object.values(db)) {
    if (m && typeof m === "object") {
      for (const fn of Object.values(m as object)) {
        if (typeof fn === "function" && "mockResolvedValue" in (fn as any)) {
          ;(fn as Mock).mockResolvedValue(undefined)
        }
      }
    }
  }
  db.$transaction = vi.fn(async (arg: any) =>
    typeof arg === "function" ? arg(db) : Promise.all(arg)
  )
})

describe("Authentication — unauthenticated requests are rejected (401)", () => {
  it("GET /api/customers/[id] returns 401 with no session", async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import("@/app/api/customers/[id]/route")
    const res = await GET(jsonReq("/api/customers/c1", "GET"), params({ id: "c1" }))
    expect(res.status).toBe(401)
  })

  it("GET /api/expenses returns 401 with no session", async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import("@/app/api/expenses/route")
    const res = await GET(jsonReq("/api/expenses", "GET"))
    expect(res.status).toBe(401)
  })
})

describe("Authorization — OWNER-only money/destructive routes reject STAFF (403)", () => {
  it("POST /api/payments/[id]/refund -> 403 for STAFF", async () => {
    mockAuth.mockResolvedValue(session("STAFF"))
    const { POST } = await import("@/app/api/payments/[id]/refund/route")
    const res = await POST(jsonReq("/api/payments/p1/refund", "POST", { amount: 100 }), params({ id: "p1" }))
    expect(res.status).toBe(403)
  })

  it("POST /api/customers/[id]/points -> 403 for STAFF", async () => {
    mockAuth.mockResolvedValue(session("STAFF"))
    const { POST } = await import("@/app/api/customers/[id]/points/route")
    const res = await POST(jsonReq("/api/customers/c1/points", "POST", { type: "add", points: 50 }), params({ id: "c1" }))
    expect(res.status).toBe(403)
  })

  it("POST /api/expenses -> 403 for STAFF", async () => {
    mockAuth.mockResolvedValue(session("STAFF"))
    const { POST } = await import("@/app/api/expenses/route")
    const res = await POST(jsonReq("/api/expenses", "POST", { amount: 100, category: "x", date: new Date().toISOString() }))
    expect(res.status).toBe(403)
  })

  it("PATCH /api/receivables/[id] -> 403 for STAFF", async () => {
    mockAuth.mockResolvedValue(session("STAFF"))
    const { PATCH } = await import("@/app/api/receivables/[id]/route")
    const res = await PATCH(jsonReq("/api/receivables/r1", "PATCH", { status: "PAID" }), params({ id: "r1" }))
    expect(res.status).toBe(403)
  })

  it("OWNER is allowed through the role gate (refund reaches validation, not 403)", async () => {
    mockAuth.mockResolvedValue(session("OWNER"))
    const { POST } = await import("@/app/api/payments/[id]/refund/route")
    // amount 0 fails positiveMoney validation -> 400, proving the OWNER passed the role gate
    const res = await POST(jsonReq("/api/payments/p1/refund", "POST", { amount: 0 }), params({ id: "p1" }))
    expect(res.status).toBe(400)
  })
})

describe("Input validation", () => {
  it("refund rejects non-positive amount (400)", async () => {
    mockAuth.mockResolvedValue(session("OWNER"))
    const { POST } = await import("@/app/api/payments/[id]/refund/route")
    const res = await POST(jsonReq("/api/payments/p1/refund", "POST", { amount: -5 }), params({ id: "p1" }))
    expect(res.status).toBe(400)
  })

  it("stored-value rejects amount below the floor (400) — and does NOT 403 STAFF", async () => {
    mockAuth.mockResolvedValue(session("STAFF"))
    const { POST } = await import("@/app/api/customers/[id]/stored-value/route")
    const res = await POST(jsonReq("/api/customers/c1/stored-value", "POST", { amount: 10 }), params({ id: "c1" }))
    expect(res.status).toBe(400) // validation, not authorization
  })
})

describe("Public endpoints — token / verifier required", () => {
  it("grooming confirm rejects a missing viewToken (400)", async () => {
    const { POST } = await import("@/app/api/grooming/[id]/confirm/route")
    const res = await POST(
      jsonReq("/api/grooming/g1/confirm", "POST", { signature: "data:image/png;base64,AAAA" }),
      params({ id: "g1" })
    )
    expect(res.status).toBe(400)
  })

  it("booking lookup discloses NO PII for phone-only (no name verifier)", async () => {
    // Phone-only must short-circuit before any DB access and disclose nothing.
    const { GET } = await import("@/app/api/booking/[shopId]/lookup/route")
    const res = await GET(jsonReq("/api/booking/shop-A/lookup?phone=0912345678", "GET"), params({ shopId: "shop-A" }))
    const data = await res.json()
    // Must NOT disclose customerName/pets without a matching name verifier.
    expect(data.found).toBe(false)
    expect(data.customerName).toBeUndefined()
    expect(data.pets).toBeUndefined()
  })
})

describe("Tenant scoping — reads are constrained to the session shop", () => {
  it("GET /api/customers/[id] scopes the query by the session shopId", async () => {
    mockAuth.mockResolvedValue(session("OWNER", SHOP_A))
    db.customer.findFirst.mockResolvedValue(null)
    const { GET } = await import("@/app/api/customers/[id]/route")
    await GET(jsonReq("/api/customers/c1", "GET"), params({ id: "c1" }))
    expect(db.customer.findFirst).toHaveBeenCalled()
    const arg = db.customer.findFirst.mock.calls[0][0]
    expect(arg.where).toMatchObject({ id: "c1", shopId: SHOP_A })
  })
})
