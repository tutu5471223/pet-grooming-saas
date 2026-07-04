"use client"

import { useSession } from "next-auth/react"
import { Scissors } from "lucide-react"
import { NotificationBell } from "@/components/layout/notification-bell"

export function MobileHeader() {
  const { data: session } = useSession()
  return (
    <header className="sm:hidden fixed top-0 left-0 right-0 z-40 h-12 bg-gray-950 flex items-center justify-between px-4 border-b border-gray-800">
      <div className="flex items-center gap-2 min-w-0">
        <Scissors className="h-4 w-4 text-indigo-400 shrink-0" />
        <span className="text-sm font-semibold text-white truncate">
          {session?.user?.shopName ?? "PetOS71"}
        </span>
      </div>
      <NotificationBell collapsed={false} placement="mobile-top" />
    </header>
  )
}
