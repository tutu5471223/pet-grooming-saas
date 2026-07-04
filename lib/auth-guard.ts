import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { parsePermissions, hasPermission, type StaffPermissions } from "@/lib/permissions"

export interface AuthContext {
  userId: string
  shopId: string
  role: string
  isSuperAdmin: boolean
  shopStatus: string
  permissions: StaffPermissions
}

type GuardResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse }

/**
 * Verifies session exists and extracts auth context.
 *
 * - 401 if unauthenticated (no `shopId` claim). A deactivated account's token is
 *   stripped of `shopId` in auth.ts, so it lands here (C1).
 * - 403 (H2) if the shop is not ACTIVE. Shop status (PENDING / SUSPENDED /
 *   REJECTED / MERGED) is enforced HERE, on the API surface, not only via the
 *   dashboard layout redirect — otherwise `curl + cookie` bypasses every
 *   platform-level shop control. Superadmins bypass the status gate.
 */
export async function requireAuth(): Promise<GuardResult> {
  const session = await auth()
  if (!session?.user?.shopId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  const isSuperAdmin = session.user.isSuperAdmin === true
  const shopStatus = session.user.shopStatus ?? ""
  if (!isSuperAdmin && shopStatus !== "ACTIVE") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "店家尚未啟用或已停權", code: "SHOP_INACTIVE" },
        { status: 403 }
      ),
    }
  }
  return {
    ok: true,
    ctx: {
      userId: session.user.id,
      shopId: session.user.shopId,
      role: session.user.role,
      isSuperAdmin,
      shopStatus,
      permissions: parsePermissions(session.user.permissions),
    },
  }
}

/**
 * Like requireAuth() but also checks a specific permission.
 * OWNER role always passes. STAFF must have the permission flag set to true.
 */
export async function requirePermission(perm: keyof StaffPermissions): Promise<GuardResult> {
  const result = await requireAuth()
  if (!result.ok) return result

  if (!hasPermission(result.ctx.role, result.ctx.permissions, perm)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }
  return result
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
