"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera } from "lucide-react"
import Image from "next/image"

interface PetPhotoUploadProps {
  petId: string
  photoUrl: string | null
  petName: string
}

export function PetPhotoUpload({ petId, photoUrl, petName }: PetPhotoUploadProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [localUrl, setLocalUrl] = useState(photoUrl)

  async function handleFile(file: File) {
    setUploading(true)
    setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd })
      if (!uploadRes.ok) {
        const d = await uploadRes.json()
        throw new Error(d.error || "上傳失敗")
      }
      const { url } = await uploadRes.json()
      const patchRes = await fetch(`/api/pets/${petId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: url }),
      })
      if (!patchRes.ok) throw new Error("更新失敗")
      setLocalUrl(url)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "上傳失敗")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ""
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative group"
        title="點擊更換寵物照片"
      >
        {localUrl ? (
          <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-white shadow-md">
            <Image src={localUrl} alt={petName} fill className="object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="h-6 w-6 text-white" />
            </div>
          </div>
        ) : (
          <div className="h-24 w-24 rounded-full border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-indigo-400 hover:text-indigo-400 transition-colors">
            <Camera className="h-6 w-6" />
            <span className="text-xs">上傳照片</span>
          </div>
        )}
      </button>
      {uploading && <p className="text-xs text-gray-500">上傳中...</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
