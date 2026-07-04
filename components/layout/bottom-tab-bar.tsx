"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
  Package,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"

const tabs = [
  { href: "/dashboard", icon: LayoutDashboard, label: "儀表板", ownerOnly: false },
  { href: "/customers", icon: Users, label: "客人", ownerOnly: false },
  { href: "/appointments", icon: Calendar, label: "預約", ownerOnly: false },
  { href: "/reports", icon: BarChart3, label: "報表", ownerOnly: true },
  { href: "/products", icon: Package, label: "商品", ownerOnly: false },
  { href: "/settings", icon: Settings, label: "設定", ownerOnly: true },
]

export function BottomTabBar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isOwner = session?.user?.role === "OWNER"

  const visibleTabs = tabs.filter((tab) => !tab.ownerOnly || isOwner)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch border-t border-gray-200 bg-white sm:hidden">
      {visibleTabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/")
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
              active ? "text-indigo-600" : "text-gray-400"
            )}
          >
            <tab.icon className={cn("h-5 w-5", active ? "text-indigo-600" : "text-gray-400")} />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
