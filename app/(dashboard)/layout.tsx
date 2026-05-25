import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Sidebar } from "@/components/layout/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }

  // Superadmin bypasses all shop-status checks
  if (!session.user.isSuperAdmin) {
    const shop = await prisma.shop.findUnique({
      where: { id: session.user.shopId },
      select: { status: true, onboardingDone: true },
    })

    if (!shop || shop.status === "PENDING" || shop.status === "REJECTED") {
      redirect("/pending")
    }
    if (shop.status === "SUSPENDED") {
      redirect("/suspended")
    }
    if (!shop.onboardingDone) {
      redirect("/onboarding")
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
