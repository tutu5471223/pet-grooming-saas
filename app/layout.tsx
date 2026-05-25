import type { Metadata } from "next"
import { Noto_Sans_TC } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/layout/providers"

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto",
})

export const metadata: Metadata = {
  title: "寵物美容管理系統",
  description: "專業寵物美容 SaaS 管理平台",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-TW" className={`${notoSansTC.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
