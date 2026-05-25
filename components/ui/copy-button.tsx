"use client"

export function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text)}
      className="shrink-0 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50"
    >
      複製連結
    </button>
  )
}
