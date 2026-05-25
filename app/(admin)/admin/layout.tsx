import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Scissors, LayoutDashboard, Building2, BarChart3, LogOut } from "lucide-react"
import { signOut } from "@/auth"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.isSuperAdmin) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col border-r border-gray-800 bg-gray-950">
        <div className="flex h-14 items-center gap-2 border-b border-gray-800 px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600">
            <Scissors className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">超級管理員</p>
            <p className="text-xs text-gray-500">平台後台</p>
          </div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1">
          {[
            { href: "/admin", icon: LayoutDashboard, label: "平台總覽" },
            { href: "/admin/shops", icon: Building2, label: "店家管理" },
            { href: "/admin/stats", icon: BarChart3, label: "統計數據" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-800 p-3">
          <p className="text-xs text-gray-500 px-2 mb-2">{session.user.name}</p>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }) }}>
            <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
              <LogOut className="h-4 w-4" /> 登出
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
