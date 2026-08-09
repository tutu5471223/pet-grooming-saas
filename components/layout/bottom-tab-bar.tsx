"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  Users,
  Calendar,
  Home,
  BarChart3,
  TrendingDown,
  Package,
  ShoppingBag,
  Settings,
  ClipboardList,
  MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { parsePermissions, type StaffPermissions } from "@/lib/permissions"

interface NavItem {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  ownerOnly: boolean
  permKey?: string
}

// 主導覽（日常操作，所有人可見）——住宿留在主導覽
const mainTabs: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "儀表板", ownerOnly: false },
  { href: "/customers", icon: Users, label: "客人", ownerOnly: false },
  { href: "/appointments", icon: Calendar, label: "預約", ownerOnly: false },
  { href: "/boarding", icon: Home, label: "住宿", ownerOnly: false },
]

// 「更多」收納的次要／管理功能（依權限過濾）
const moreItems: NavItem[] = [
  { href: "/reports", icon: BarChart3, label: "營收報表", ownerOnly: true, permKey: "reports" },
  { href: "/expenses", icon: TrendingDown, label: "支出管理", ownerOnly: true, permKey: "expenses" },
  { href: "/products", icon: Package, label: "商品管理", ownerOnly: false },
  { href: "/sales", icon: ShoppingBag, label: "銷售紀錄", ownerOnly: false },
  { href: "/settings", icon: Settings, label: "系統設定", ownerOnly: true, permKey: "settings" },
  { href: "/audit-logs", icon: ClipboardList, label: "操作記錄", ownerOnly: true },
]

function canSee(item: NavItem, isOwner: boolean, perms: StaffPermissions): boolean {
  if (!item.ownerOnly) return true
  if (isOwner) return true
  if (item.permKey === "settings") return !!(perms.settings || perms.staff)
  if (item.permKey) return !!(perms as Record<string, boolean | undefined>)[item.permKey]
  return false
}

export function BottomTabBar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isOwner = session?.user?.role === "OWNER"
  const perms = parsePermissions(session?.user?.permissions)
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")
  const visibleMore = moreItems.filter((i) => canSee(i, isOwner, perms))
  const moreActive = visibleMore.some((i) => isActive(i.href))

  return (
    <>
      {/* 「更多」彈出選單（僅手機/平板） */}
      {moreOpen && (
        <div className="hidden max-lg:block">
          <button
            aria-label="關閉更多選單"
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed bottom-16 left-0 right-0 z-50 border-t border-gray-200 bg-white shadow-lg">
            <div className="grid grid-cols-3 gap-1 p-3">
              {visibleMore.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg py-3 text-xs font-medium transition-colors",
                      active ? "bg-indigo-50 text-indigo-600" : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 hidden max-lg:flex h-16 items-stretch border-t border-gray-200 bg-white">
        {mainTabs.map((tab) => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => setMoreOpen(false)}
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
        {/* 更多 */}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
            moreOpen || moreActive ? "text-indigo-600" : "text-gray-400"
          )}
        >
          <MoreHorizontal className={cn("h-5 w-5", moreOpen || moreActive ? "text-indigo-600" : "text-gray-400")} />
          更多
        </button>
      </nav>
    </>
  )
}
