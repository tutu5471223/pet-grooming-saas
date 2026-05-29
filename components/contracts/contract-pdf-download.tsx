"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface ContractPDFData {
  shopName: string
  petName: string
  species: string
  breed: string | null
  customerName: string
  contractContent: string
  signedAt: string | null
  signerName: string | null
  signatureUrl: string | null
}

// px per mm at 150 dpi
const DPM = 150 / 25.4

function makeCanvas(widthPx: number, heightPx: number) {
  const c = document.createElement("canvas")
  c.width = widthPx
  c.height = heightPx
  return c
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []
  for (const para of text.split("\n")) {
    if (!para.trim()) { lines.push(""); continue }
    let cur = ""
    for (const ch of para) {
      if (ctx.measureText(cur + ch).width > maxW && cur) {
        lines.push(cur)
        cur = ch
      } else {
        cur += ch
      }
    }
    if (cur) lines.push(cur)
  }
  return lines
}

export function ContractPDFDownload({ data }: { data: ContractPDFData }) {
  const [generating, setGenerating] = useState(false)

  async function handleDownload() {
    setGenerating(true)
    try {
      const { jsPDF } = await import("jspdf")

      const PAGE_W = 210 // mm
      const PAGE_H = 297 // mm
      const MARGIN = 15  // mm
      const CW = PAGE_W - MARGIN * 2 // content width mm
      const CW_PX = Math.round(CW * DPM)
      const FONT = `"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif`

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      let y = MARGIN // current Y in mm

      // Adds a block of lines to the PDF, handles page breaks, returns height added (mm)
      function block(
        lines: string[],
        fsz: number,
        opts: { bold?: boolean; color?: string; bg?: string; padMM?: number } = {}
      ): number {
        const { bold = false, color = "#1a1a1a", bg = "", padMM = 0 } = opts
        const fszPx = fsz * DPM
        const lhPx = fszPx * 1.65
        const padPx = padMM * DPM
        const canvH = Math.ceil(lines.length * lhPx + padPx * 2 + 6)

        const cv = makeCanvas(CW_PX, canvH)
        const ctx = cv.getContext("2d")!
        ctx.font = `${bold ? "bold " : ""}${fszPx}px ${FONT}`
        ctx.textBaseline = "top"

        if (bg) {
          ctx.fillStyle = bg
          ctx.fillRect(0, 0, CW_PX, canvH)
        }
        ctx.fillStyle = color
        lines.forEach((l, i) => ctx.fillText(l, padPx + 2, padPx + 3 + i * lhPx))

        const hMM = canvH / DPM
        if (y + hMM > PAGE_H - MARGIN) { pdf.addPage(); y = MARGIN }
        pdf.addImage(cv.toDataURL("image/png"), "PNG", MARGIN, y, CW, hMM)
        return hMM
      }

      // Splits raw text into wrapped lines using a temp canvas
      function measure(text: string, fsz: number, bold = false): string[] {
        const cv = makeCanvas(CW_PX, 4)
        const ctx = cv.getContext("2d")!
        ctx.font = `${bold ? "bold " : ""}${fsz * DPM}px ${FONT}`
        return wrapText(ctx, text, CW_PX - 6)
      }

      // ── Title ──
      y += block(measure(data.shopName, 11), 11, { color: "#4f46e5" })
      y += 3
      y += block(measure("寵物美容服務合約", 20, true), 20, { bold: true })
      y += 5

      // ── Pet info box ──
      y += block(
        measure(`寵物姓名：${data.petName}（${data.breed ?? data.species}）\n飼主姓名：${data.customerName}`, 13),
        13,
        { bg: "#f5f3ff", padMM: 3.5 }
      )
      y += 5

      // ── Contract content ──
      const plainContent = data.contractContent
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
      const contentLines = measure(plainContent, 12.5)
      // Render in chunks of 12 lines to keep canvas sizes small
      for (let i = 0; i < contentLines.length; i += 12) {
        y += block(contentLines.slice(i, i + 12), 12.5)
      }
      y += 5

      // ── Signature info ──
      y += block(["── 簽署資訊 ──"], 11, { color: "#9ca3af" })
      y += 2

      const sigLines: string[] = []
      if (data.signerName) sigLines.push(`簽署人：${data.signerName}`)
      if (data.signedAt) {
        const dt = new Date(data.signedAt).toLocaleString("zh-TW", {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit",
        })
        sigLines.push(`簽署時間：${dt}`)
      }
      if (sigLines.length) {
        y += block(measure(sigLines.join("\n"), 13), 13)
        y += 3
      }

      // ── Signature image ──
      if (data.signatureUrl) {
        y += block(["手寫簽名："], 11, { color: "#6b7280" })
        y += 2

        await new Promise<void>((resolve) => {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.onload = () => {
            const sigWmm = Math.min(75, CW)
            const sigHmm = (img.naturalHeight / img.naturalWidth) * sigWmm
            if (y + sigHmm > PAGE_H - MARGIN) { pdf.addPage(); y = MARGIN }

            const sc = makeCanvas(img.naturalWidth, img.naturalHeight)
            const sctx = sc.getContext("2d")!
            sctx.fillStyle = "#ffffff"
            sctx.fillRect(0, 0, sc.width, sc.height)
            sctx.drawImage(img, 0, 0)
            pdf.addImage(sc.toDataURL("image/png"), "PNG", MARGIN, y, sigWmm, sigHmm)
            y += sigHmm
            resolve()
          }
          img.onerror = () => resolve()
          img.src = data.signatureUrl!
        })
      }

      // Use arraybuffer + object URL instead of pdf.save() — the Node.js jsPDF
      // build's save() calls fs.writeFileSync which throws in browser bundles.
      const today = new Date().toISOString().split("T")[0]
      const filename = `合約_${data.petName}_${today}.pdf`
      const ab = pdf.output("arraybuffer")
      const blob = new Blob([ab], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (err) {
      console.error("PDF generation failed", err)
      alert("PDF 生成失敗，請重試")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Button onClick={handleDownload} disabled={generating} variant="outline" size="sm">
      <Download className="h-4 w-4" />
      {generating ? "生成中..." : "下載合約 PDF"}
    </Button>
  )
}
