import { prisma } from "@/lib/prisma"

export const UNLIMITED = 999999

export interface SubscriptionInfo {
  status: string
  planName: string
  maxCustomers: number
  maxPets: number
  maxStaff: number
  currentPeriodEnd: Date
  daysRemaining: number
  isExpired: boolean
}

export async function getSubscription(shopId: string): Promise<SubscriptionInfo | null> {
  const sub = await prisma.subscription.findFirst({
    where: { shopId },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  })
  if (!sub) return null

  const now = new Date()
  const daysRemaining = Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  const isExpired = sub.currentPeriodEnd < now && sub.status !== "ACTIVE"

  return {
    status: sub.status,
    planName: sub.plan.name,
    maxCustomers: sub.plan.maxCustomers,
    maxPets: sub.plan.maxPets,
    maxStaff: sub.plan.maxStaff,
    currentPeriodEnd: sub.currentPeriodEnd,
    daysRemaining,
    isExpired,
  }
}

// M6: subscription must be in an active billing state for usage to be allowed.
const ACTIVE_STATUSES = ["ACTIVE", "TRIAL"]

/** Returns a rejection if the subscription is expired or not in an allowed status. */
function checkSubscriptionActive(sub: SubscriptionInfo): { allowed: boolean; message?: string } | null {
  if (sub.isExpired || !ACTIVE_STATUSES.includes(sub.status)) {
    return { allowed: false, message: "訂閱已到期，請續訂" }
  }
  return null
}

export async function checkCustomerLimit(shopId: string): Promise<{ allowed: boolean; message?: string }> {
  const sub = await getSubscription(shopId)
  if (!sub) return { allowed: true }
  const expired = checkSubscriptionActive(sub)
  if (expired) return expired
  if (sub.maxCustomers >= UNLIMITED) return { allowed: true }

  const count = await prisma.customer.count({ where: { shopId, status: "ACTIVE" } })
  if (count >= sub.maxCustomers) {
    return { allowed: false, message: `已達方案上限（${sub.maxCustomers} 位客人），請升級方案` }
  }
  return { allowed: true }
}

export async function checkStaffLimit(shopId: string): Promise<{ allowed: boolean; message?: string }> {
  const sub = await getSubscription(shopId)
  if (!sub) return { allowed: true }
  const expired = checkSubscriptionActive(sub)
  if (expired) return expired
  if (sub.maxStaff >= UNLIMITED) return { allowed: true }

  const count = await prisma.user.count({ where: { shopId, isActive: true } })
  if (count >= sub.maxStaff) {
    return { allowed: false, message: `已達方案上限（${sub.maxStaff} 位員工），請升級方案` }
  }
  return { allowed: true }
}

export async function checkPetLimit(shopId: string): Promise<{ allowed: boolean; message?: string }> {
  const sub = await getSubscription(shopId)
  if (!sub) return { allowed: true }
  const expired = checkSubscriptionActive(sub)
  if (expired) return expired
  if (sub.maxPets >= UNLIMITED) return { allowed: true }

  const count = await prisma.pet.count({ where: { shopId, isActive: true } })
  if (count >= sub.maxPets) {
    return { allowed: false, message: `已達方案上限（${sub.maxPets} 隻寵物），請升級方案` }
  }
  return { allowed: true }
}
