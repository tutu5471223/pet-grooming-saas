"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Pet {
  id: string
  name: string
  species: string
  breed: string | null
  gender: string
  birthday: string | null
  chipNumber: string | null
  diseases: string | null
  allergies: string | null
  notes: string | null
}

export default function PetEditPage({
  params,
}: {
  params: Promise<{ id: string; petId: string }>
}) {
  const { id: customerId, petId } = use(params)
  const router = useRouter()

  const [form, setForm] = useState({
    name: "",
    species: "犬",
    breed: "",
    gender: "UNKNOWN",
    birthday: "",
    chipNumber: "",
    diseases: "",
    allergies: "",
    notes: "",
  })
  const [petName, setPetName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    fetch(`/api/pets/${petId}`)
      .then((r) => r.json())
      .then((data: Pet) => {
        setPetName(data.name)
        setForm({
          name: data.name,
          species: data.species,
          breed: data.breed ?? "",
          gender: data.gender,
          birthday: data.birthday
            ? new Date(data.birthday).toISOString().split("T")[0]
            : "",
          chipNumber: data.chipNumber ?? "",
          diseases: data.diseases ?? "",
          allergies: data.allergies ?? "",
          notes: data.notes ?? "",
        })
      })
      .catch(() => setError("無法載入寵物資料"))
      .finally(() => setFetching(false))
  }, [petId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/pets/${petId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          species: form.species,
          breed: form.breed || null,
          gender: form.gender,
          birthday: form.birthday || null,
          chipNumber: form.chipNumber || null,
          diseases: form.diseases || null,
          allergies: form.allergies || null,
          notes: form.notes || null,
        }),
      })
      if (!res.ok) throw new Error("儲存失敗")
      router.push(`/customers/${customerId}/pets/${petId}`)
      router.refresh()
    } catch {
      setError("儲存失敗，請再試一次")
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-gray-400">
        載入中...
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/customers/${customerId}/pets/${petId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">編輯寵物資料</h1>
          <p className="text-sm text-gray-500 mt-0.5">{petName}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">寵物資料</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">寵物名稱 *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>物種</Label>
                <Select
                  value={form.species}
                  onValueChange={(v) => setForm({ ...form, species: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="犬">🐕 犬</SelectItem>
                    <SelectItem value="貓">🐈 貓</SelectItem>
                    <SelectItem value="兔">🐇 兔</SelectItem>
                    <SelectItem value="鳥">🦜 鳥</SelectItem>
                    <SelectItem value="其他">🐾 其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="breed">品種</Label>
                <Input
                  id="breed"
                  placeholder="選填"
                  value={form.breed}
                  onChange={(e) => setForm({ ...form, breed: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>性別</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => setForm({ ...form, gender: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">公</SelectItem>
                    <SelectItem value="FEMALE">母</SelectItem>
                    <SelectItem value="UNKNOWN">未知</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="birthday">生日</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={form.birthday}
                  onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chipNumber">晶片號碼</Label>
                <Input
                  id="chipNumber"
                  placeholder="15碼"
                  value={form.chipNumber}
                  onChange={(e) => setForm({ ...form, chipNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="diseases">特殊疾病</Label>
              <Input
                id="diseases"
                placeholder="例：心臟病、氣管塌陷（選填）"
                value={form.diseases}
                onChange={(e) => setForm({ ...form, diseases: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="allergies">過敏紀錄</Label>
              <Input
                id="allergies"
                placeholder="例：對某洗毛精過敏（選填）"
                value={form.allergies}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">備註</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "儲存中..." : "儲存變更"}
              </Button>
              <Link href={`/customers/${customerId}/pets/${petId}`}>
                <Button type="button" variant="outline">取消</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
