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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PERSONALITY_OPTIONS = ["黏人", "膽小", "親人", "活潑", "易怒", "咬人", "討厭狗狗", "討厭貓咪"]
const BLOW_DRYER_OPTIONS = ["完全接受", "有點怕", "非常怕"]
const AFTER_GROOM_OPTIONS = ["自由落地", "桌上限制活動", "圍片限制活動", "回到自己外出籠", "以上皆可"]

const EMPTY_FORM = {
  name: "", species: "犬", breed: "", gender: "UNKNOWN", birthday: "", chipNumber: "", notes: "",
  personality: [] as string[],
  boneIssue: false, boneNote: "",
  skinIssue: false, skinNote: "",
  earIssue: false, earNote: "",
  eyeIssue: false, eyeNote: "",
  heartDisease: false, boneDisease: false, skinDisease: false,
  epilepsy: false, diabetes: false,
  surgeryHistory: false, surgeryNote: "",
  otherDisease: "",
  bathFrequency: "", groomFrequency: "", blowDryerFear: "",
  afterGroomHandle: "", consentPhoto: false, consentSnack: false, snackAllergy: "",
}

type FormState = typeof EMPTY_FORM

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
        active ? "border-indigo-500 bg-indigo-600 text-white" : "border-gray-200 text-gray-600 hover:border-indigo-300"
      }`}>
      {label}
    </button>
  )
}

function IssueRow({
  label, active, note, onToggle, onNote,
}: { label: string; active: boolean; note: string; onToggle: () => void; onNote: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggle}
          className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${
            active ? "border-red-400 bg-red-500 text-white" : "border-gray-200 text-gray-500 hover:border-gray-400"
          }`}>
          {active ? "有問題" : "正常"}
        </button>
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      {active && (
        <Input placeholder="說明..." value={note} onChange={(e) => onNote(e.target.value)} className="h-8 text-sm" />
      )}
    </div>
  )
}

export default function PetEditPage({
  params,
}: {
  params: Promise<{ id: string; petId: string }>
}) {
  const { id: customerId, petId } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [petName, setPetName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fetching, setFetching] = useState(true)

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function togglePersonality(tag: string) {
    setForm((f) => ({
      ...f,
      personality: f.personality.includes(tag)
        ? f.personality.filter((t) => t !== tag)
        : [...f.personality, tag],
    }))
  }

  useEffect(() => {
    fetch(`/api/pets/${petId}`)
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => {
        setPetName(data.name as string)
        setForm({
          name: (data.name as string) ?? "",
          species: (data.species as string) ?? "犬",
          breed: (data.breed as string | null) ?? "",
          gender: (data.gender as string) ?? "UNKNOWN",
          birthday: data.birthday ? new Date(data.birthday as string).toISOString().split("T")[0] : "",
          chipNumber: (data.chipNumber as string | null) ?? "",
          notes: (data.notes as string | null) ?? "",
          personality: (data.personality as string[] | null) ?? [],
          boneIssue: (data.boneIssue as boolean) ?? false,
          boneNote: (data.boneNote as string | null) ?? "",
          skinIssue: (data.skinIssue as boolean) ?? false,
          skinNote: (data.skinNote as string | null) ?? "",
          earIssue: (data.earIssue as boolean) ?? false,
          earNote: (data.earNote as string | null) ?? "",
          eyeIssue: (data.eyeIssue as boolean) ?? false,
          eyeNote: (data.eyeNote as string | null) ?? "",
          heartDisease: (data.heartDisease as boolean) ?? false,
          boneDisease: (data.boneDisease as boolean) ?? false,
          skinDisease: (data.skinDisease as boolean) ?? false,
          epilepsy: (data.epilepsy as boolean) ?? false,
          diabetes: (data.diabetes as boolean) ?? false,
          surgeryHistory: (data.surgeryHistory as boolean) ?? false,
          surgeryNote: (data.surgeryNote as string | null) ?? "",
          otherDisease: (data.otherDisease as string | null) ?? "",
          bathFrequency: (data.bathFrequency as string | null) ?? "",
          groomFrequency: (data.groomFrequency as string | null) ?? "",
          blowDryerFear: (data.blowDryerFear as string | null) ?? "",
          afterGroomHandle: (data.afterGroomHandle as string | null) ?? "",
          consentPhoto: (data.consentPhoto as boolean) ?? false,
          consentSnack: (data.consentSnack as boolean) ?? false,
          snackAllergy: (data.snackAllergy as string | null) ?? "",
        })
      })
      .catch(() => setError("無法載入寵物資料"))
      .finally(() => setFetching(false))
  }, [petId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError("")
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
          notes: form.notes || null,
          personality: form.personality,
          boneIssue: form.boneIssue, boneNote: form.boneNote || null,
          skinIssue: form.skinIssue, skinNote: form.skinNote || null,
          earIssue: form.earIssue, earNote: form.earNote || null,
          eyeIssue: form.eyeIssue, eyeNote: form.eyeNote || null,
          heartDisease: form.heartDisease, boneDisease: form.boneDisease,
          skinDisease: form.skinDisease, epilepsy: form.epilepsy, diabetes: form.diabetes,
          surgeryHistory: form.surgeryHistory, surgeryNote: form.surgeryNote || null,
          otherDisease: form.otherDisease || null,
          bathFrequency: form.bathFrequency || null, groomFrequency: form.groomFrequency || null,
          blowDryerFear: form.blowDryerFear || null, afterGroomHandle: form.afterGroomHandle || null,
          consentPhoto: form.consentPhoto, consentSnack: form.consentSnack,
          snackAllergy: form.snackAllergy || null,
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
    return <div className="p-6 flex items-center justify-center h-64 text-gray-400">載入中...</div>
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/customers/${customerId}/pets/${petId}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">編輯寵物資料</h1>
          <p className="text-sm text-gray-500 mt-0.5">{petName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Tabs defaultValue="basic">
          <TabsList className="w-full">
            <TabsTrigger value="basic" className="flex-1">基本資料</TabsTrigger>
            <TabsTrigger value="health" className="flex-1">健康資料</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: 基本資料 ── */}
          <TabsContent value="basic" className="mt-4">
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">寵物名稱 *</Label>
                    <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>物種</Label>
                    <Select value={form.species} onValueChange={(v) => set("species", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <Input id="breed" placeholder="選填" value={form.breed} onChange={(e) => set("breed", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>性別</Label>
                    <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <Input id="birthday" type="date" value={form.birthday} onChange={(e) => set("birthday", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="chipNumber">晶片號碼</Label>
                    <Input id="chipNumber" placeholder="15碼" value={form.chipNumber} onChange={(e) => set("chipNumber", e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">備註</Label>
                  <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 2: 健康資料 ── */}
          <TabsContent value="health" className="mt-4 space-y-4">
            {/* 個性標籤 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">個性標籤</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {PERSONALITY_OPTIONS.map((tag) => (
                  <ToggleChip key={tag} label={tag} active={form.personality.includes(tag)} onClick={() => togglePersonality(tag)} />
                ))}
              </CardContent>
            </Card>

            {/* 身體狀況 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">身體狀況</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <IssueRow label="骨骼" active={form.boneIssue} note={form.boneNote} onToggle={() => set("boneIssue", !form.boneIssue)} onNote={(v) => set("boneNote", v)} />
                <IssueRow label="皮膚" active={form.skinIssue} note={form.skinNote} onToggle={() => set("skinIssue", !form.skinIssue)} onNote={(v) => set("skinNote", v)} />
                <IssueRow label="耳朵" active={form.earIssue} note={form.earNote} onToggle={() => set("earIssue", !form.earIssue)} onNote={(v) => set("earNote", v)} />
                <IssueRow label="眼睛" active={form.eyeIssue} note={form.eyeNote} onToggle={() => set("eyeIssue", !form.eyeIssue)} onNote={(v) => set("eyeNote", v)} />
              </CardContent>
            </Card>

            {/* 病史分類 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">病史分類</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "heartDisease" as const, label: "心臟病" },
                    { key: "boneDisease" as const, label: "骨骼疾病" },
                    { key: "skinDisease" as const, label: "皮膚疾病" },
                    { key: "epilepsy" as const, label: "癲癇" },
                    { key: "diabetes" as const, label: "糖尿病" },
                  ].map(({ key, label }) => (
                    <ToggleChip key={key} label={label} active={form[key]} onClick={() => set(key, !form[key])} />
                  ))}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => set("surgeryHistory", !form.surgeryHistory)}
                      className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${
                        form.surgeryHistory ? "border-indigo-500 bg-indigo-600 text-white" : "border-gray-200 text-gray-600 hover:border-indigo-300"
                      }`}>手術史</button>
                  </div>
                  {form.surgeryHistory && (
                    <Input placeholder="手術說明..." value={form.surgeryNote}
                      onChange={(e) => set("surgeryNote", e.target.value)} className="h-8 text-sm" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">其他病史</Label>
                  <Input placeholder="其他需注意的疾病..." value={form.otherDisease}
                    onChange={(e) => set("otherDisease", e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* 美容習慣 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">美容習慣</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">洗澡頻率</Label>
                    <Input placeholder="例：每月一次" value={form.bathFrequency}
                      onChange={(e) => set("bathFrequency", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">美容頻率</Label>
                    <Input placeholder="例：每兩個月" value={form.groomFrequency}
                      onChange={(e) => set("groomFrequency", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">吹風機接受度</Label>
                  <div className="flex gap-2 flex-wrap">
                    {BLOW_DRYER_OPTIONS.map((opt) => (
                      <ToggleChip key={opt} label={opt} active={form.blowDryerFear === opt}
                        onClick={() => set("blowDryerFear", form.blowDryerFear === opt ? "" : opt)} />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 同意事項 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">主人同意事項</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">美容後處置方式</Label>
                  <div className="flex gap-2 flex-wrap">
                    {AFTER_GROOM_OPTIONS.map((opt) => (
                      <ToggleChip key={opt} label={opt} active={form.afterGroomHandle === opt}
                        onClick={() => set("afterGroomHandle", form.afterGroomHandle === opt ? "" : opt)} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.consentPhoto} onChange={(e) => set("consentPhoto", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                    同意拍照作為美容紀錄
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.consentSnack} onChange={(e) => set("consentSnack", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                    同意美容過程中給予零食獎勵
                  </label>
                </div>
                {form.consentSnack && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">零食過敏資訊</Label>
                    <Input placeholder="不能吃的零食種類..." value={form.snackAllergy}
                      onChange={(e) => set("snackAllergy", e.target.value)} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "儲存中..." : "儲存變更"}
          </Button>
          <Link href={`/customers/${customerId}/pets/${petId}`}>
            <Button type="button" variant="outline">取消</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
