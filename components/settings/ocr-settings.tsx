"use client"

import { useState } from "react"
import { ScanLine, Save, RotateCcw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DEFAULT_OCR_KEYWORDS, type OcrKeywords } from "@/lib/ocr-keywords"

interface OcrSettingsProps {
  shopId: string
  initialKeywords: string | null
}

function parseInitial(raw: string | null): OcrKeywords {
  if (!raw) return { ...DEFAULT_OCR_KEYWORDS }
  try {
    const parsed = JSON.parse(raw) as Partial<OcrKeywords>
    const keys = Object.keys(DEFAULT_OCR_KEYWORDS) as (keyof OcrKeywords)[]
    const result = { ...DEFAULT_OCR_KEYWORDS }
    for (const k of keys) {
      const v = parsed[k]
      if (Array.isArray(v) && v.length > 0) result[k] = v as string[]
    }
    return result
  } catch {
    return { ...DEFAULT_OCR_KEYWORDS }
  }
}

function KeywordField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  value: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <Input
        value={value.join("、")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(/[、,，\s]+/)
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        placeholder={placeholder}
      />
      <p className="text-xs text-gray-400">多個關鍵字用「、」或逗號分隔</p>
    </div>
  )
}

export function OcrSettings({ shopId, initialKeywords }: OcrSettingsProps) {
  const [kw, setKw] = useState<OcrKeywords>(() => parseInitial(initialKeywords))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function update<K extends keyof OcrKeywords>(k: K, v: OcrKeywords[K]) {
    setKw((prev) => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/shops/${shopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ocrKeywords: JSON.stringify(kw) }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScanLine className="h-4 w-4" /> OCR 掃描辨識關鍵字
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-gray-500">
            自訂「掃描紙本快速建檔」時，辨識各欄位的關鍵字。請根據您使用的紙本表單格式調整。
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <KeywordField
              label="飼主姓名關鍵字"
              placeholder="第一聯絡人、飼主、姓名"
              value={kw.ownerNameKeys}
              onChange={(v) => update("ownerNameKeys", v)}
            />
            <KeywordField
              label="主要電話關鍵字"
              placeholder="電話、手機"
              value={kw.phoneKeys}
              onChange={(v) => update("phoneKeys", v)}
            />
            <KeywordField
              label="備註（第二聯絡人）關鍵字"
              placeholder="第二聯絡人"
              value={kw.notesKeys}
              onChange={(v) => update("notesKeys", v)}
            />
            <KeywordField
              label="寵物名稱關鍵字"
              placeholder="寵物名稱、名字、小名"
              value={kw.petNameKeys}
              onChange={(v) => update("petNameKeys", v)}
            />
            <KeywordField
              label="寵物品種關鍵字"
              placeholder="品種"
              value={kw.breedKeys}
              onChange={(v) => update("breedKeys", v)}
            />
            <KeywordField
              label="寵物生日關鍵字"
              placeholder="生日、出生日期"
              value={kw.birthdayKeys}
              onChange={(v) => update("birthdayKeys", v)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? "儲存中..." : saved ? "已儲存！" : "儲存設定"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setKw({ ...DEFAULT_OCR_KEYWORDS })}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              恢復預設
            </Button>
          </div>

          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-700">
              儲存後，下次使用「掃描紙本快速建檔」時會自動套用新關鍵字。
              民國年格式（如 112/3/5）會自動轉換為西元年。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
