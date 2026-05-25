"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Save, Eye } from "lucide-react"

export function ContractTemplateEditor({
  shopId,
  initialContent,
}: {
  shopId: string
  initialContent: string
}) {
  const [content, setContent] = useState(initialContent)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState(false)

  async function handleSave() {
    setLoading(true)
    await fetch(`/api/shops/${shopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractTemplate: content }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" /> 合約範本編輯
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreview(!preview)}
          >
            <Eye className="h-4 w-4" />
            {preview ? "編輯" : "預覽"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4" />
            {loading ? "儲存中..." : saved ? "已儲存 ✓" : "儲存範本"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 mb-3">
          支援 HTML 格式。範本將套用於每隻新建寵物的合約。
        </p>
        {preview ? (
          <div
            className="prose prose-sm max-w-none rounded-xl border border-gray-200 p-6 min-h-[400px] bg-white"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white p-4 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[400px]"
            placeholder="輸入合約內容（支援 HTML）..."
          />
        )}
      </CardContent>
    </Card>
  )
}
