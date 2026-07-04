"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Calendar,
  Home,
  BarChart3,
  Settings,
  LogOut,
  Scissors,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  TrendingDown,
  Package,
  ShoppingBag,
  ShieldCheck,
} from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { NotificationBell } from "@/components/layout/notification-bell"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "儀表板", ownerOnly: false },
  { href: "/customers", icon: Users, label: "客人管理", ownerOnly: false },
  { href: "/appointments", icon: Calendar, label: "預約排程", ownerOnly: false },
  { href: "/boarding", icon: Home, label: "住宿管理", ownerOnly: false },
  { href: "/reports", icon: BarChart3, label: "營收報表", ownerOnly: true },
  { href: "/expenses", icon: TrendingDown, label: "支出管理", ownerOnly: true },
  { href: "/products", icon: Package, label: "商品管理", ownerOnly: false },
  { href: "/sales", icon: ShoppingBag, label: "銷售紀錄", ownerOnly: false },
  { href: "/settings", icon: Settings, label: "系統設定", ownerOnly: true },
  { href: "/audit-logs", icon: ClipboardList, label: "操作記錄", ownerOnly: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = useState(false)

  // Auto-collapse on mobile
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 768) setCollapsed(true)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <aside
      className={cn(
        "relative hidden sm:flex h-screen flex-col border-r border-gray-200 bg-gray-950 text-white transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-800 px-4">
        <Scissors className="h-6 w-6 text-indigo-400 shrink-0" />
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <div className="text-sm font-bold text-white truncate">
              {session?.user?.shopName ?? "寵物美容"}
            </div>
            <div className="text-xs text-gray-400 truncate">管理後台</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => {
          if (item.ownerOnly && session?.user?.role !== "OWNER") return null
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}

        {/* SuperAdmin link */}
        {session?.user?.isSuperAdmin && (
          <>
            {!collapsed && (
              <div className="mx-3 my-2 border-t border-gray-800" />
            )}
            <Link
              href="/superadmin"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/superadmin")
                  ? "bg-indigo-600 text-white"
                  : "text-indigo-400 hover:bg-gray-800 hover:text-indigo-300"
              )}
            >
              <ShieldCheck className="h-5 w-5 shrink-0" />
              {!collapsed && <span>超級管理後台</span>}
            </Link>
          </>
        )}
      </nav>

      {/* Notification bell */}
      <div className="border-t border-gray-800 px-2 pt-2">
        <NotificationBell collapsed={collapsed} />
      </div>

      {/* User + Logout */}
      <div className="border-t border-gray-800 p-3">
        {!collapsed && session?.user && (
          <div className="mb-3 px-2">
            <div className="text-xs font-medium text-white truncate">{session.user.name}</div>
            <div className="text-xs text-gray-400 truncate">{session.user.email}</div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>登出</span>}
        </button>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  )
}
