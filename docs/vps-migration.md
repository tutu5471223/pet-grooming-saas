# VPS 搬移指南：Render → DigitalOcean

## 1. Droplet 規格建議

| 項目 | 建議規格 | 說明 |
|---|---|---|
| 方案 | Basic（Premium Intel）| 不需 CPU-Optimized |
| CPU | 1 vCPU → 2 vCPU | 初期 1 vCPU 足夠，流量大再升 |
| RAM | **2 GB** | Next.js build 需要 ≥1.5 GB，2 GB 有餘裕 |
| SSD | 50 GB | 含 PostgreSQL 資料與 build 產物 |
| OS | **Ubuntu 24.04 LTS** | 長期支援，套件最新 |
| 地區 | **Singapore（SGP1）**| 台灣用戶延遲最低 |
| 月費 | 約 $12 USD/月 | 比 Render Pro 便宜且效能更穩定 |

> 若未來多店家流量增加，可垂直升級（Resize）或加 Managed Database。

---

## 2. 需要安裝的軟體

```bash
# 更新套件
apt update && apt upgrade -y

# Node.js 22 LTS（使用 NodeSource）
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# PostgreSQL 16
apt install -y postgresql postgresql-contrib

# Nginx（反向代理 + SSL）
apt install -y nginx certbot python3-certbot-nginx

# PM2（Node.js 程序管理，自動重啟）
npm install -g pm2

# Git
apt install -y git

# 確認版本
node -v    # v22.x
npm -v     # 10.x
psql --version
nginx -v
pm2 -v
```

---

## 3. 環境變數清單

在 VPS 建立 `/var/www/pet-grooming-saas/.env.production`：

```env
# === 必填 ===
DATABASE_URL="postgresql://pguser:強密碼@localhost:5432/pet_grooming_db"
NEXTAUTH_SECRET="隨機64字元字串，用 openssl rand -hex 32 生成"
AUTH_TRUST_HOST=true
NODE_ENV=production
CRON_SECRET="隨機字串，用於 cron-job.org 呼叫保護"

# === LINE 整合（選填，不設定則 LINE 功能停用）===
LINE_CHANNEL_ACCESS_TOKEN="從 LINE Developers Console 取得"
LINE_CHANNEL_SECRET="從 LINE Developers Console 取得"

# === AI OCR（選填，不設定則 OCR 功能停用）===
ANTHROPIC_API_KEY="sk-ant-..."

# === 資料庫 SSL（Render 外部 DB 需要，本機 PostgreSQL 不需要）===
# DATABASE_SSL_INSECURE=true   # 僅在 DB 無正式 CA 憑證時用

# === 種子帳號（只有 db:seed 時用，production 不需要）===
# SEED_OWNER_EMAIL=
# ALLOW_SEED=
```

生成 `NEXTAUTH_SECRET` 的指令：
```bash
openssl rand -hex 32
```

---

## 4. PostgreSQL 設定

### 4.1 建立資料庫和使用者

```bash
sudo -u postgres psql
```

```sql
CREATE USER pguser WITH PASSWORD '強密碼';
CREATE DATABASE pet_grooming_db OWNER pguser;
GRANT ALL PRIVILEGES ON DATABASE pet_grooming_db TO pguser;
\q
```

### 4.2 從 Render 匯出資料

在本機執行（需安裝 `pg_dump`，或在 Render 的 PostgreSQL 主控台）：

```bash
# 匯出（Render DB URL 從 .env 取得）
pg_dump \
  "postgresql://pet_grooming_db_user:密碼@dpg-d8asuelckfvc73dhphi0-a.singapore-postgres.render.com/pet_grooming_db" \
  --no-acl --no-owner \
  -f backup.sql

# 匯入到 VPS（在 VPS 執行）
psql -U pguser -d pet_grooming_db < backup.sql
```

> ⚠️ 匯入前確認 VPS 的 PostgreSQL 是空的資料庫，否則先 DROP 再 CREATE。

---

## 5. DNS 設定

假設你的網域是 `yourdomain.com`，在網域商的 DNS 管理頁面新增：

| 類型 | 名稱 | 值 | TTL |
|---|---|---|---|
| A | `@` 或 `yourdomain.com` | VPS 的 IP（例如 `167.71.x.x`）| 300 |
| A | `www` | VPS 的 IP | 300 |

DNS 生效需要 5 分鐘～48 小時。

取得 SSL 憑證（DNS 生效後）：
```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 6. Nginx 設定

建立 `/etc/nginx/sites-available/pet-grooming-saas`：

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # 安全標頭（Next.js 已在 next.config.ts 設定，這裡加 Nginx 層備援）
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

啟用：
```bash
ln -s /etc/nginx/sites-available/pet-grooming-saas /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 7. 部署步驟

### 7.1 首次部署

```bash
# 1. Clone 專案
mkdir -p /var/www
cd /var/www
git clone https://github.com/tutu5471223/pet-grooming-saas.git
cd pet-grooming-saas

# 2. 設定環境變數
cp .env.example .env.production   # 或直接建立 .env.production
# 填入所有必填變數（參考第 3 節）

# 3. 安裝依賴
NODE_ENV=development npm ci        # 安裝含 devDependencies（build 需要）

# 4. 生成 Prisma Client
npx prisma generate

# 5. 套用資料庫 Migration（若從空 DB 開始）
npx prisma migrate deploy

# 若從 Render 匯入了資料，改執行：
# npx prisma migrate resolve --applied 0_init
# npx prisma migrate deploy

# 6. Build
npm run build

# 7. 啟動（用 PM2）
pm2 start npm --name "pet-grooming" -- start
pm2 save
pm2 startup   # 依指示執行輸出的指令，讓 PM2 開機自動啟動
```

### 7.2 更新部署

```bash
cd /var/www/pet-grooming-saas
git pull origin main
NODE_ENV=development npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart pet-grooming
```

### 7.3 PM2 常用指令

```bash
pm2 status                    # 查看狀態
pm2 logs pet-grooming         # 查看即時 log
pm2 logs pet-grooming --lines 100  # 查看最近 100 行 log
pm2 restart pet-grooming      # 重啟
pm2 stop pet-grooming         # 停止
```

---

## 8. cron-job.org 更新

部署完成後，到 cron-job.org 更新提醒排程的 URL：

| 工作 | URL（舊：Render）| URL（新：VPS）|
|---|---|---|
| 預約提醒 | `https://petos71.com/api/cron/reminder` | `https://yourdomain.com/api/cron/reminder` |
| 預約提醒（備用）| `https://petos71.com/api/cron/appointment-reminder` | `https://yourdomain.com/api/cron/appointment-reminder` |

Header 保持不變：`Authorization: Bearer <CRON_SECRET>`

---

## 9. 搬移後確認清單

```
□ 瀏覽器開啟 https://yourdomain.com 能正常顯示登入頁
□ 登入 tutu5471223@gmail.com / Tutu880223 成功
□ 儀表板資料正確（代表 DB 匯入成功）
□ 自助預約 /booking/Tutu123456 正常
□ 公開價目表 /menu/Tutu123456 正常
□ LINE webhook 已更新為新網址（LINE Developers Console → Webhook URL）
□ cron-job.org 的 URL 已更新
□ SSL 憑證有效（瀏覽器無警告）
□ pm2 status 顯示 online
□ 舊 Render 服務可停用（節省費用）
```
