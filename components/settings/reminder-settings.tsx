"use client"

import { useState } from "react"
import { Bell, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface ReminderSettingsProps {
  shopId: string
  initialTemplate: string | null
}

const DEFAULT_TEMPLATE = `您好，{name}！
提醒您明天 {time} 有一個寵物美容預約。
如需更改請提前告知，謝謝！`

export function ReminderSettings({ shopId, initialTemplate }: ReminderSettingsProps) {
  const [template, setTemplate] = useState(initialTemplate ?? DEFAULT_TEMPLATE)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/shops/${shopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderTemplate: template }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const variables = ["{name}", "{phone}", "{time}", "{date}", "{services}"]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> 預約提醒訊息範本
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">訊息範本</Label>
            <Textarea
              rows={6}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder={DEFAULT_TEMPLATE}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">
              可用變數：{variables.map((v) => (
                <code key={v} className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-gray-700">{v}</code>
              ))}
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
            <p className="text-sm font-medium text-amber-800">預覽</p>
            <p className="text-sm text-amber-700 whitespace-pre-line">
              {template
                .replace("{name}", "王小明")
                .replace("{phone}", "0912345678")
                .replace("{time}", "14:00")
                .replace("{date}", "明天（5月5日）")
                .replace("{services}", "全套美容")}
            </p>
          </div>

          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-700">
              此範本用於手動複製傳送 LINE / SMS 提醒訊息。
              可在客人預約詳情頁快速複製個人化內容。
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? "儲存中..." : saved ? "已儲存！" : "儲存範本"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTemplate(DEFAULT_TEMPLATE)}
            >
              重設預設
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
