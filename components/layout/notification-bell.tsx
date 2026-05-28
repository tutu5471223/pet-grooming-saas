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
  const [confirmNotif, setConfirmNotif] = useState<Notification | null>(null)
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
      setConfirmNotif(n)
    }
  }

  function handleConfirmNav() {
    setConfirmNotif(null)
    router.push("/appointments")
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

      {/* Confirm navigation dialog */}
      {confirmNotif && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-gray-900 mb-2">前往預約排程？</h3>
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 mb-4">
              <p className="text-sm font-medium text-indigo-800 mb-1">{confirmNotif.title}</p>
              {confirmNotif.body && (
                <p className="text-xs text-indigo-700 whitespace-pre-line">{confirmNotif.body}</p>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4">是否前往預約排程頁面查看並確認此預約？</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmNotif(null)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmNav}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                前往排程
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
