import { auth } from "@/auth"
import { NextResponse } from "next/server"

export interface AuthContext {
  userId: string
  shopId: string
  role: string
}

type GuardResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse }

/**
 * Verifies session exists and extracts auth context.
 * Returns 401 if unauthenticated.
 */
export async function requireAuth(): Promise<GuardResult> {
  const session = await auth()
  if (!session?.user?.shopId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  return {
    ok: true,
    ctx: {
      userId: session.user.id,
      shopId: session.user.shopId,
      role: session.user.role,
    },
  }
}

/**
 * Like requireAuth() but also enforces role membership.
 * Returns 403 if role not in allowed list.
 */
export async function requireRole(roles: string[]): Promise<GuardResult> {
  const result = await requireAuth()
  if (!result.ok) return result

  if (!roles.includes(result.ctx.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }
  return result
}

/**
 * Verifies that a resource's shopId matches the session shopId.
 * Throws nothing — returns a 403 response to be returned directly if mismatched.
 */
export function assertShopOwnership(
  sessionShopId: string,
  resourceShopId: string
): NextResponse | null {
  if (sessionShopId !== resourceShopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}
