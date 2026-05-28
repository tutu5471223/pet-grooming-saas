"use client"

import { useState, useEffect, useRef } from "react"
import { Bell } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatDateTime } from "@/lib/utils"

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  isRead: boolean
  relatedId: string | null
  createdAt: string
}

export function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const data = await res.json()
      setUnreadCount(data.unreadCount ?? 0)
      setNotifications(data.notifications ?? [])
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => {})
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleOpen() {
    setOpen(o => !o)
    if (!open && unreadCount > 0) markAllRead()
  }

  function handleNotifClick(n: Notification) {
    if (n.type === "BOOKING_REQUEST") {
      setOpen(false)
      router.push("/appointments?view=week")
    }
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={handleOpen}
          className="relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors w-full"
          title="通知"
        >
          <Bell className="h-5 w-5 shrink-0" />
          {!collapsed && <span>通知</span>}
          {unreadCount > 0 && (
            <span className="absolute left-6 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute bottom-12 left-0 z-50 w-80 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">通知</p>
              {notifications.some(n => !n.isRead) && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-indigo-600 hover:text-indigo-700"
                >
                  全部已讀
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">暫無通知</p>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!n.isRead ? "bg-indigo-50" : ""} ${n.type === "BOOKING_REQUEST" ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${!n.isRead ? "text-indigo-900" : "text-gray-900"}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="h-2 w-2 rounded-full bg-red-500 shrink-0 mt-1" />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-line">{n.body}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDateTime(new Date(n.createdAt))}
                    </p>
                    {n.type === "BOOKING_REQUEST" && (
                      <p className="text-xs text-indigo-500 mt-1">點擊前往預約排程 →</p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

    </>
  )
}
