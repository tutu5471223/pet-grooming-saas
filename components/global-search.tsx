"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, X, Users, PawPrint, Calendar } from "lucide-react"
import { format } from "date-fns"
import { appointmentStatusLabel } from "@/lib/utils"

interface SearchResults {
  customers: { id: string; name: string; phone: string; flagType?: string | null }[]
  pets: { id: string; name: string; breed: string | null; species: string; customer: { id: string; name: string } }[]
  appointments: { id: string; scheduledAt: string; status: string; type: string; pet: { id: string; name: string; customer: { id: string; name: string } } }[]
}

const FLAG_ICONS: Record<string, string> = { WARNING: "⚠️", BLOCKED: "🚫", VIP: "⭐" }

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // cmd+K / ctrl+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQuery(""); setResults(null) }
  }, [open])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults(null); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (res.ok) setResults(await res.json())
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  function navigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  const hasResults = results && (results.customers.length + results.pets.length + results.appointments.length) > 0

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">搜尋...</span>
        <kbd className="hidden sm:inline text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-400">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
              <Search className="h-5 w-5 text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋客人、寵物、預約..."
                className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              )}
              {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent shrink-0" />}
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto p-2">
              {!query && (
                <p className="px-3 py-4 text-sm text-center text-gray-400">輸入關鍵字開始搜尋</p>
              )}
              {query && !loading && !hasResults && results && (
                <p className="px-3 py-4 text-sm text-center text-gray-400">找不到「{query}」的結果</p>
              )}

              {results?.customers && results.customers.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">客人</p>
                  {results.customers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/customers/${c.id}`)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold shrink-0">
                        {c.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">
                          {c.flagType && FLAG_ICONS[c.flagType]} {c.name}
                        </p>
                        <p className="text-xs text-gray-500">{c.phone}</p>
                      </div>
                      <Users className="h-4 w-4 text-gray-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {results?.pets && results.pets.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">寵物</p>
                  {results.pets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/customers/${p.customer.id}/pets/${p.id}`)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xl shrink-0">
                        {p.species === "犬" ? "🐕" : p.species === "貓" ? "🐈" : "🐾"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.breed ?? p.species} · {p.customer.name}</p>
                      </div>
                      <PawPrint className="h-4 w-4 text-gray-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {results?.appointments && results.appointments.length > 0 && (
                <div>
                  <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">預約</p>
                  {results.appointments.map((a) => {
                    const status = appointmentStatusLabel(a.status)
                    return (
                      <button
                        key={a.id}
                        onClick={() => navigate(`/appointments?date=${format(new Date(a.scheduledAt), "yyyy-MM-dd")}`)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 shrink-0">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{a.pet.name}</p>
                          <p className="text-xs text-gray-500">{format(new Date(a.scheduledAt), "MM/dd HH:mm")} · {a.pet.customer.name}</p>
                        </div>
                        <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${status.color}`}>{status.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
