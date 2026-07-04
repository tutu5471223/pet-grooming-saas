#!/usr/bin/env node
/**
 * LINE 圖文選單建立腳本（Tutu 寵物美容）
 * 執行方式：node scripts/create-richmenu.js
 *
 * 完成後請刪除此檔案或移除 TOKEN，避免 token 外洩。
 */

const https = require("https")
const zlib  = require("zlib")

const TOKEN = process.env.TOKEN || "FLHvIh3Y431cybFw8Z8i3zvgK2WYwprieLlfL13q6qGE9cAlLAIVzj2mIlpNFdTsntVeJOWDfeAdFOLSZS9ib8ycbQ4xZ1h7kFjS40C0G/WTXrxJMjmkNmGLsB0V8IAoBtqNa9LlRgsxcKenP6Wy4AdB04t89/1O/w1cDnyilFU="

// ── HTTP 工具 ─────────────────────────────────────────────────────────────────

function apiRequest(method, host, path, headers, body) {
  const bodyBuf =
    body instanceof Buffer ? body
    : body              ? Buffer.from(JSON.stringify(body), "utf8")
    :                     null

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path,
        method,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          ...(bodyBuf ? { "Content-Length": bodyBuf.length } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8")
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(text)) } catch { resolve({}) }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${text}`))
          }
        })
      }
    )
    req.on("error", reject)
    if (bodyBuf) req.write(bodyBuf)
    req.end()
  })
}

// ── PNG 生成器（純 Node.js，無外部依賴）──────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++)
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const lenBuf = Buffer.allocUnsafe(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, "ascii")
  const crcVal  = Buffer.allocUnsafe(4)
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcVal])
}

/**
 * 生成 2500×1686 四格 PNG（藍/綠/橘/紫，白色分隔線）
 * 格子對應：TL=線上預約  TR=查詢會員  BL=聯絡電話  BR=價目表
 */
function buildRichMenuPNG(width, height) {
  process.stdout.write("  生成圖片像素資料…")

  const midX    = Math.floor(width  / 2)
  const midY    = Math.floor(height / 2)
  const divHalf = 5  // 白色分隔線半寬 px

  // 預先建三種 scanline（含 filter byte 0）
  function buildScanline(leftRGB, rightRGB, allWhite) {
    const row = Buffer.alloc(1 + width * 3)
    row[0] = 0
    let p = 1
    for (let x = 0; x < width; x++) {
      const onV = x >= midX - divHalf && x < midX + divHalf
      let c
      if (allWhite || onV) c = [255, 255, 255]
      else if (x < midX)   c = leftRGB
      else                 c = rightRGB
      row[p++] = c[0]; row[p++] = c[1]; row[p++] = c[2]
    }
    return row
  }

  const rowTop  = buildScanline([26, 115, 232], [52, 168,  83], false) // 藍|綠
  const rowDiv  = buildScanline([255,255,255],  [255,255, 255], true)  // 全白
  const rowBot  = buildScanline([230,126, 34],  [103, 58, 183], false) // 橘|紫

  const parts = []
  for (let y = 0; y < height; y++) {
    const onH = y >= midY - divHalf && y < midY + divHalf
    parts.push(onH ? rowDiv : y < midY ? rowTop : rowBot)
  }

  process.stdout.write(" 壓縮中…")
  const raw        = Buffer.concat(parts)
  const compressed = zlib.deflateSync(raw, { level: 6 })
  console.log(" 完成")

  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(width,  0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8]  = 8  // bit depth
  ihdr[9]  = 2  // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
}

// ── 圖文選單定義 ──────────────────────────────────────────────────────────────

const RICH_MENU = {
  size:        { width: 2500, height: 1686 },
  selected:    true,
  name:        "Tutu 寵物美容選單",
  chatBarText: "選單",
  areas: [
    // 格1：線上預約（左上）
    {
      bounds: { x: 0, y: 0, width: 1250, height: 843 },
      action: { type: "uri", label: "線上預約", uri: "https://petos71.com/booking/Tutu123456" },
    },
    // 格2：查詢會員（右上）
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 843 },
      action: { type: "message", label: "查詢會員", text: "查詢" },
    },
    // 格3：聯絡電話（左下）
    {
      bounds: { x: 0, y: 843, width: 1250, height: 843 },
      action: { type: "message", label: "聯絡電話", text: "電話" },
    },
    // 格4：價目表（右下）
    {
      bounds: { x: 1250, y: 843, width: 1250, height: 843 },
      action: { type: "uri", label: "價目表", uri: "https://petos71.com/menu/Tutu123456" },
    },
  ],
}

// ── 主程式 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== LINE 圖文選單建立程式 ===\n")

  // Step 1：建立圖文選單
  console.log("步驟 1／3  建立圖文選單結構…")
  const { richMenuId } = await apiRequest(
    "POST", "api.line.me", "/v2/bot/richmenu",
    { "Content-Type": "application/json" },
    RICH_MENU,
  )
  console.log(`  ✅ richMenuId = ${richMenuId}\n`)

  // Step 2：生成並上傳底圖
  console.log("步驟 2／3  上傳選單底圖…")
  const png = buildRichMenuPNG(2500, 1686)
  console.log(`  PNG 大小：${(png.length / 1024).toFixed(1)} KB`)
  await apiRequest(
    "POST", "api-data.line.me", `/v2/bot/richmenu/${richMenuId}/content`,
    { "Content-Type": "image/png" },
    png,
  )
  console.log("  ✅ 圖片上傳完成\n")

  // Step 3：設定為預設選單
  console.log("步驟 3／3  設定為預設選單…")
  await apiRequest(
    "POST", "api.line.me", `/v2/bot/richmenu/default/${richMenuId}`,
    { "Content-Type": "application/json", "Content-Length": "0" },
    null,
  )
  console.log("  ✅ 已設定為預設選單\n")

  console.log("🎉 完成！")
  console.log(`   Rich Menu ID : ${richMenuId}`)
  console.log("")
  console.log("   建議後續步驟：")
  console.log("   • 至 LINE Business Center 上傳含文字的精美底圖")
  console.log("     (格1 藍=線上預約 / 格2 綠=查詢會員 / 格3 橘=聯絡電話 / 格4 紫=價目表)")
  console.log("   • 完成後刪除此腳本或清除 TOKEN")
}

main().catch((err) => {
  console.error("\n❌ 錯誤：", err.message)
  process.exit(1)
})
