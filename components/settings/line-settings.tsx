"use client"

import { useState } from "react"
import { Copy, Check, Save, MessageCircle, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LineSettingsProps {
  shopId: string
  webhookUrl: string
  initialChannelId: string | null
  initialChannelSecret: string | null
  initialToken: string | null
}

export function LineSettings({
  shopId,
  webhookUrl,
  initialChannelId,
  initialChannelSecret,
  initialToken,
}: LineSettingsProps) {
  const [copied, setCopied] = useState(false)
  const [channelId, setChannelId] = useState(initialChannelId ?? "")
  const [channelSecret, setChannelSecret] = useState(initialChannelSecret ?? "")
  const [token, setToken] = useState(initialToken ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  async function handleCopyUrl() {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSave() {
    setSaving(true)
    setError("")
    const res = await fetch(`/api/shops/${shopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineChannelId: channelId.trim() || null,
        lineChannelSecret: channelSecret.trim() || null,
        lineChannelToken: token.trim() || null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      setError("儲存失敗，請稍後再試")
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#06C755]" />
            LINE Webhook 設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">您的專屬 Webhook URL</Label>
            <div className="flex gap-2">
              <code className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 break-all">
                {webhookUrl}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyUrl} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-2">
            <p className="text-sm font-medium text-blue-800 flex items-center gap-1.5">
              <Info className="h-4 w-4" /> 設定步驟
            </p>
            <ol className="text-sm text-blue-700 space-y-1.5 list-decimal list-inside">
              <li>前往 <strong>LINE Developers Console</strong> → 選擇您的 Messaging API 頻道</li>
              <li>在「Messaging API」頁籤找到「Webhook URL」欄位</li>
              <li>貼上上方您的專屬 Webhook URL 後儲存</li>
              <li>啟用「Use webhook」選項</li>
              <li>點擊「Verify」確認連線正常</li>
            </ol>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-amber-800">
              <strong>客人綁定方式：</strong>客人在 LINE 官方帳號中傳送「手機號碼 姓名」（例如：0912345678 王小明），
              系統將自動比對並完成帳號綁定，之後預約確認、美容完工通知將自動傳送。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* LINE Channel Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">LINE Channel 設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            在 LINE Developers Console 申請 Messaging API 後，填入以下資訊即可啟用店家專屬 LINE 帳號。
            若未填入，系統將使用共用帳號。
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="lineChannelId" className="text-sm">Channel ID</Label>
            <Input
              id="lineChannelId"
              placeholder="例如：1234567890"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">Channel ID 可在 LINE Developers Console → 選擇您的 Channel → Basic settings 頁面找到，或直接查看網址列中的數字。</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lineChannelSecret" className="text-sm">Channel Secret</Label>
            <Input
              id="lineChannelSecret"
              type="password"
              placeholder="貼上您的 Channel Secret"
              value={channelSecret}
              onChange={(e) => setChannelSecret(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">用於驗證 Webhook 簽名，請妥善保管。</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lineToken" className="text-sm">Channel Access Token</Label>
            <Input
              id="lineToken"
              type="password"
              placeholder="貼上您的 Channel Access Token（長效版）"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">用於發送推播訊息給客人。</p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "儲存中..." : saved ? "已儲存！" : "儲存 LINE 設定"}
          </Button>
        </CardContent>
      </Card>

      {/* Cron reminder info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">前一天自動提醒</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            系統提供每日自動提醒 API，可透過外部排程服務（Render Cron Job / GitHub Actions）
            在每天晚上 8 點呼叫，自動發送隔天預約的 LINE 提醒給已綁定帳號的客人。
          </p>
          <div className="space-y-1.5">
            <Label className="text-sm">提醒 API 端點</Label>
            <code className="block rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 break-all">
              GET {webhookUrl.replace(`/api/line/webhook/${shopId}`, "/api/cron/appointment-reminder")}?secret=$CRON_SECRET
            </code>
          </div>
          <p className="text-xs text-gray-500">
            需在 Render 環境變數設定 <code className="bg-gray-100 px-1 rounded">CRON_SECRET</code> 後，於 Render Cron Job 設定每天 20:00（台灣時間）執行。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
