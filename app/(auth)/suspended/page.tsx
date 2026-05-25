import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Scissors, ShieldOff, LogOut } from "lucide-react"

export default async function SuspendedPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const shop = await prisma.shop.findUnique({
    where: { id: session.user.shopId },
    select: { status: true, name: true },
  })

  if (shop?.status === "ACTIVE") redirect("/dashboard")
  if (shop?.status === "PENDING" || shop?.status === "REJECTED") redirect("/pending")

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldOff className="h-8 w-8 text-red-500" />
          </div>

          <div className="mb-2 flex items-center justify-center gap-2">
            <Scissors className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">{shop?.name}</span>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-3">帳號已停用</h2>
          <p className="text-sm text-gray-500 mb-6">
            您的店家帳號已被停用，無法使用系統。<br />
            如需協助，請聯絡客服。
          </p>

          <div className="rounded-xl bg-red-50 border border-red-200 p-4 mb-6 text-sm text-red-700">
            客服信箱：support@petgrooompro.com
          </div>

          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2 mx-auto text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              登出
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
