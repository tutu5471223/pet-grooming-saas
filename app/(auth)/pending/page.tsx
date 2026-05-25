import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Scissors, Clock, XCircle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function PendingPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const shop = await prisma.shop.findUnique({
    where: { id: session.user.shopId },
    select: { status: true, name: true },
  })

  // If somehow active, send to dashboard
  if (shop?.status === "ACTIVE") redirect("/dashboard")
  if (shop?.status === "SUSPENDED") redirect("/suspended")

  const isRejected = shop?.status === "REJECTED"

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl text-center">
          <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${isRejected ? "bg-red-100" : "bg-yellow-100"}`}>
            {isRejected ? (
              <XCircle className="h-8 w-8 text-red-500" />
            ) : (
              <Clock className="h-8 w-8 text-yellow-500" />
            )}
          </div>

          <div className="mb-2 flex items-center justify-center gap-2">
            <Scissors className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-medium text-indigo-600">{shop?.name}</span>
          </div>

          {isRejected ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-3">申請未通過</h2>
              <p className="text-sm text-gray-500 mb-6">
                很抱歉，您的店家申請未通過審核。<br />
                如有疑問請聯絡客服，或重新提交申請。
              </p>
              <Link href="/register">
                <Button className="w-full mb-3">重新申請</Button>
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-3">帳號審核中</h2>
              <p className="text-sm text-gray-500 mb-6">
                您的店家申請正在審核中，通常於 1–2 個工作天內完成。<br />
                審核通過後將以 Email 通知您。
              </p>
              <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 mb-6 text-sm text-yellow-800">
                審核通過後，請重新登入即可使用系統。
              </div>
            </>
          )}

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
