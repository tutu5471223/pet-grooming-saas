"use client"

import { useRouter, usePathname } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useTransition } from "react"

export function CustomerSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    startTransition(() => {
      if (value) {
        router.push(`${pathname}?search=${encodeURIComponent(value)}`)
      } else {
        router.push(pathname)
      }
    })
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <Input
        type="search"
        placeholder="搜尋姓名、電話、LINE ID..."
        defaultValue={defaultValue}
        onChange={handleSearch}
        className="pl-10"
      />
    </div>
  )
}
