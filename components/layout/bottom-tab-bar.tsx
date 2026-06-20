"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Calendar,
  Home,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/dashboard", icon: LayoutDashboard, label: "儀表板" },
  { href: "/customers", icon: Users, label: "客人" },
  { href: "/appointments", icon: Calendar, label: "預約" },
  { href: "/boarding", icon: Home, label: "住宿" },
  { href: "/settings", icon: Settings, label: "設定" },
]

export function BottomTabBar() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch border-t border-gray-200 bg-white sm:hidden">
      {tabs.map((tab) => {
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
