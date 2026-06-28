import Link from "next/link"
import { Scissors } from "lucide-react"

export const metadata = {
  title: "服務條款 | 寵物美容管理系統",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600">
            <Scissors className="h-7 w-7 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">服務條款</h1>
        <p className="text-gray-500">頁面建置中，敬請期待</p>
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          返回首頁
        </Link>
      </div>
    </div>
  )
}
