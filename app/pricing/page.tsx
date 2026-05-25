import Link from "next/link"
import { Check, Scissors, Star, Zap, ChevronRight } from "lucide-react"

const plans = [
  {
    name: "免費試用",
    subtitle: "14 天完整體驗",
    price: 0,
    interval: "",
    color: "border-gray-200 bg-white",
    headerBg: "bg-gray-50",
    badge: null,
    limits: "50 客人 / 100 寵物 / 2 員工",
    features: [
      "完整預約排程管理",
      "客人與寵物資料庫",
      "美容記錄與照片",
      "住宿管理",
      "線上預約連結",
      "基本收支報表",
    ],
    cta: "免費開始試用",
    ctaHref: "/register",
    ctaStyle: "bg-gray-900 text-white hover:bg-gray-800",
    icon: Star,
  },
  {
    name: "基礎版",
    subtitle: "適合小型美容店",
    price: 499,
    interval: "/ 月",
    color: "border-indigo-200 bg-white ring-2 ring-indigo-500",
    headerBg: "bg-indigo-600",
    badge: "最受歡迎",
    limits: "200 客人 / 500 寵物 / 5 員工",
    features: [
      "所有試用版功能",
      "客人黑名單 / 旗標管理",
      "批次通知發送",
      "週視圖行事曆",
      "應收帳款管理",
      "會員等級自動升降",
      "服務分類管理",
      "操作稽核記錄",
    ],
    cta: "立即升級",
    ctaHref: "/register",
    ctaStyle: "bg-indigo-600 text-white hover:bg-indigo-700",
    icon: Zap,
  },
  {
    name: "專業版",
    subtitle: "連鎖店 / 高流量需求",
    price: 999,
    interval: "/ 月",
    color: "border-amber-200 bg-white",
    headerBg: "bg-gradient-to-r from-amber-500 to-orange-500",
    badge: "無限制",
    limits: "無限客人 / 無限寵物 / 無限員工",
    features: [
      "所有基礎版功能",
      "無限客人 & 寵物",
      "無限員工帳號",
      "員工業績統計",
      "客戶回流分析",
      "每日結帳報表匯出",
      "進階 BI 報表",
      "優先客服支援",
    ],
    cta: "聯絡我們升級",
    ctaHref: "mailto:hello@petsaas.com",
    ctaStyle: "bg-amber-500 text-white hover:bg-amber-600",
    icon: Scissors,
  },
]

const faqs = [
  { q: "試用期結束後會自動扣費嗎？", a: "不會。試用期結束後帳號將進入限制模式，不會自動升級或扣費，您可以隨時選擇要升級的方案。" },
  { q: "可以隨時取消嗎？", a: "可以。您可以隨時在設定頁面取消訂閱，取消後在當期到期前仍可繼續使用。" },
  { q: "資料安全性如何？", a: "所有資料存放於安全的雲端資料庫，傳輸全程加密（TLS），我們不會分享您的客人資料給第三方。" },
  { q: "支援哪些付款方式？", a: "目前支援信用卡（Visa / Mastercard）和銀行轉帳。" },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
            <Scissors className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">PetGroomPro</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">登入</Link>
          <Link href="/register" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            免費試用
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-4 pt-16 pb-12 max-w-3xl mx-auto">
        <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 mb-4">
          透明定價，無隱藏費用
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          讓您的寵物美容店<br />
          <span className="text-indigo-600">數位化升級</span>
        </h1>
        <p className="text-lg text-gray-500">
          從預約排程到財務報表，一個平台管理所有業務。<br />
          免費試用 14 天，感受看看吧。
        </p>
      </section>

      {/* Plans */}
      <section className="px-4 pb-16 max-w-5xl mx-auto">
        <div className="grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className={`rounded-2xl border overflow-hidden shadow-sm ${plan.color}`}>
              {/* Header */}
              <div className={`px-6 py-5 ${plan.headerBg}`}>
                <div className="flex items-center justify-between mb-1">
                  <plan.icon className={`h-5 w-5 ${plan.headerBg.includes("indigo") || plan.headerBg.includes("amber") || plan.headerBg.includes("gradient") ? "text-white" : "text-gray-600"}`} />
                  {plan.badge && (
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
                      {plan.badge}
                    </span>
                  )}
                </div>
                <h2 className={`text-xl font-bold mt-2 ${plan.headerBg.includes("indigo") || plan.headerBg.includes("amber") || plan.headerBg.includes("gradient") ? "text-white" : "text-gray-900"}`}>
                  {plan.name}
                </h2>
                <p className={`text-sm ${plan.headerBg.includes("indigo") || plan.headerBg.includes("amber") || plan.headerBg.includes("gradient") ? "text-white/70" : "text-gray-500"}`}>
                  {plan.subtitle}
                </p>
              </div>

              <div className="px-6 py-5">
                {/* Price */}
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-gray-900">
                    {plan.price === 0 ? "免費" : `NT$${plan.price.toLocaleString()}`}
                  </span>
                  {plan.interval && (
                    <span className="text-sm text-gray-500">{plan.interval}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-4">{plan.limits}</p>

                <Link
                  href={plan.ctaHref}
                  className={`flex items-center justify-center gap-1.5 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors mb-5 ${plan.ctaStyle}`}
                >
                  {plan.cta}
                  <ChevronRight className="h-4 w-4" />
                </Link>

                {/* Features */}
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature highlight */}
      <section className="bg-indigo-600 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            超過 500 家寵物美容店已選擇我們
          </h2>
          <p className="text-indigo-200 mb-8">
            從單人工作室到連鎖門市，各種規模的美容店都在使用
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { n: "500+", l: "店家使用中" },
              { n: "50,000+", l: "管理寵物數" },
              { n: "99.9%", l: "服務可用率" },
              { n: "24h", l: "平均回應時間" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-white/10 px-4 py-5">
                <p className="text-2xl font-bold text-white">{s.n}</p>
                <p className="text-sm text-indigo-200 mt-1">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">常見問題</h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="font-medium text-gray-900 mb-1.5">{faq.q}</p>
              <p className="text-sm text-gray-500">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-16 px-4 text-center">
        <div className="max-w-xl mx-auto rounded-2xl bg-gray-900 px-8 py-10">
          <h2 className="text-2xl font-bold text-white mb-2">準備好開始了嗎？</h2>
          <p className="text-gray-400 mb-6">免費試用 14 天，無需信用卡</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            立即免費開始 <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-4 text-center text-sm text-gray-400">
        <p>© 2026 PetGroomPro · 保留所有權利 ·
          <Link href="/login" className="ml-2 hover:text-gray-600">登入</Link>
          <span className="mx-2">·</span>
          <Link href="/register" className="hover:text-gray-600">免費試用</Link>
        </p>
      </footer>
    </div>
  )
}
