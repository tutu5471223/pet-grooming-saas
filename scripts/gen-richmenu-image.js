#!/usr/bin/env node
/**
 * LINE 圖文選單背景圖生成腳本
 * 執行：node scripts/gen-richmenu-image.js
 */

const { createCanvas } = require("canvas")
const fs = require("fs")
const path = require("path")

// ── 規格 ──────────────────────────────────────────────────────────────────────
const W = 2500
const H = 1686
const COLS = 2
const ROWS = 2
const CW = W / COLS   // 1250
const CH = H / ROWS   // 843

// ── 顏色 ─────────────────────────────────────────────────────────────────────
const C = {
  bg:        "#FDF6E3",
  divider:   "#D4A96A",
  topBar:    "#D4A96A",
  iconBg:    "#F5E6C8",
  textMain:  "#6B4F2A",
  textSub:   "#A0845C",
  cellBg:    "#FFFDF7",
}

// ── 格子定義 ──────────────────────────────────────────────────────────────────
const CELLS = [
  { icon: "預約", title: "線上預約", sub: "點此立即預約美容" },
  { icon: "查詢", title: "查詢會員", sub: "查詢您的會員資料" },
  { icon: "電話", title: "聯絡電話", sub: "直接與我們聯絡"   },
  { icon: "價格", title: "價目表",   sub: "查看美容服務價格" },
]

// ── 輔助：圓形裁切路徑 ────────────────────────────────────────────────────────
function circle(ctx, cx, cy, r) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
}

// ── 單格繪製 ──────────────────────────────────────────────────────────────────
function drawCell(ctx, col, row, cell) {
  const x = col * CW
  const y = row * CH

  // 格子底色（淡奶油白）
  ctx.fillStyle = C.cellBg
  ctx.fillRect(x, y, CW, CH)

  // 頂部金色色條
  const barH = 18
  ctx.fillStyle = C.topBar
  ctx.fillRect(x, y, CW, barH)

  // 圓形圖示背景
  const iconR  = 145
  const iconCX = x + CW / 2
  const iconCY = y + barH + 70 + iconR
  circle(ctx, iconCX, iconCY, iconR)
  ctx.fillStyle = C.iconBg
  ctx.fill()

  // 圓形描邊
  ctx.strokeStyle = C.divider
  ctx.lineWidth = 4
  circle(ctx, iconCX, iconCY, iconR)
  ctx.stroke()

  // 圓圈內中文文字
  ctx.font = `bold 100px sans-serif`
  ctx.fillStyle = C.textMain
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(cell.icon, iconCX, iconCY + 4)

  // 大字標題
  const titleY = iconCY + iconR + 75
  ctx.font = `bold 110px sans-serif`
  ctx.fillStyle = C.textMain
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  ctx.fillText(cell.title, iconCX, titleY)

  // 底部裝飾小橫線
  const lineW = 120
  const lineY = titleY + 30
  ctx.strokeStyle = C.divider
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(iconCX - lineW / 2, lineY)
  ctx.lineTo(iconCX + lineW / 2, lineY)
  ctx.stroke()

  // 小字副標
  ctx.font = `60px sans-serif`
  ctx.fillStyle = C.textSub
  ctx.fillText(cell.sub, iconCX, lineY + 80)
}

// ── 主程式 ───────────────────────────────────────────────────────────────────
const canvas = createCanvas(W, H)
const ctx    = canvas.getContext("2d")

// 全域背景
ctx.fillStyle = C.bg
ctx.fillRect(0, 0, W, H)

// 四格
CELLS.forEach((cell, i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  drawCell(ctx, col, row, cell)
})

// 格線（最後畫，避免被格子蓋掉）
ctx.strokeStyle = C.divider
ctx.lineWidth = 6

// 垂直中線
ctx.beginPath()
ctx.moveTo(CW, 0)
ctx.lineTo(CW, H)
ctx.stroke()

// 水平中線
ctx.beginPath()
ctx.moveTo(0, CH)
ctx.lineTo(W, CH)
ctx.stroke()

// 輸出
const outPath = path.join(__dirname, "richmenu.png")
const buf = canvas.toBuffer("image/png")
fs.writeFileSync(outPath, buf)

console.log(`✅ 圖片生成完成`)
console.log(`   路徑：${outPath}`)
console.log(`   大小：${(buf.length / 1024).toFixed(1)} KB`)
console.log(`   尺寸：${W} × ${H} px`)
