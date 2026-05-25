# health-check.ps1 — 快速驗證所有關鍵頁面是否正常回應
# 使用方式：
#   .\scripts\health-check.ps1
#   .\scripts\health-check.ps1 -Port 3001
#   .\scripts\health-check.ps1 -Email "admin@maomao.com" -Password "admin123" -ShopId "demo-shop-001"

param(
    [string]$ServerHost = "localhost",
    [int]   $Port    = 3000,
    [string]$Email   = "admin@maomao.com",
    [string]$Password = "admin123",
    [string]$ShopId  = "demo-shop-001"
)

$BaseUrl  = "http://${ServerHost}:${Port}"
$CookieJar = [System.Collections.Generic.Dictionary[string,string]]::new()

# ── Helper ──────────────────────────────────────────────────────────────────
function Invoke-Page {
    param([string]$Path, [string]$Label)
    try {
        $session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
        foreach ($k in $CookieJar.Keys) {
            $c = [System.Net.Cookie]::new($k, $CookieJar[$k])
            $c.Domain = $ServerHost
            $session.Cookies.Add([Uri]"${BaseUrl}/", $c)
        }
        $resp = Invoke-WebRequest -Uri "${BaseUrl}${Path}" -WebSession $session `
                    -MaximumRedirection 3 -UseBasicParsing -ErrorAction Stop
        $icon = if ($resp.StatusCode -eq 200) { "✅" } else { "⚠️" }
        Write-Host ("  {0} [{1}] {2}" -f $icon, $resp.StatusCode, $Label)
        return $resp.StatusCode
    } catch {
        $code = $_.Exception.Response?.StatusCode?.value__ ?? "ERR"
        Write-Host ("  ❌ [{0}] {1}  →  {2}" -f $code, $Label, $_.Exception.Message.Split([Environment]::NewLine)[0])
        return $code
    }
}

# ── 1. Wait for server ────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Pet Grooming Health Check ===" -ForegroundColor Cyan
Write-Host "  Target : $BaseUrl"
Write-Host ""

$ready = $false
for ($i = 1; $i -le 15; $i++) {
    try {
        $null = Invoke-WebRequest -Uri "${BaseUrl}/api/auth/csrf" -UseBasicParsing -ErrorAction Stop
        $ready = $true; break
    } catch { Start-Sleep 2 }
}
if (-not $ready) { Write-Host "❌ Server not reachable at $BaseUrl" -ForegroundColor Red; exit 1 }
Write-Host "  Server is up" -ForegroundColor Green

# ── 2. Authenticate ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "── Authentication ──"

$csrfResp = Invoke-RestMethod -Uri "${BaseUrl}/api/auth/csrf" -SessionVariable AuthSession -UseBasicParsing
$csrfToken = $csrfResp.csrfToken
if (-not $csrfToken) { Write-Host "  ❌ Could not get CSRF token" -ForegroundColor Red; exit 1 }

$body = "email=$([Uri]::EscapeDataString($Email))&password=$([Uri]::EscapeDataString($Password))&shopId=$([Uri]::EscapeDataString($ShopId))&csrfToken=${csrfToken}&callbackUrl=%2Fdashboard&json=true"
try {
    $null = Invoke-WebRequest -Uri "${BaseUrl}/api/auth/callback/credentials" `
        -Method POST -Body $body -ContentType "application/x-www-form-urlencoded" `
        -WebSession $AuthSession -MaximumRedirection 0 -UseBasicParsing -ErrorAction SilentlyContinue
} catch {}

# Extract session token from cookies
$sessionCookie = $AuthSession.Cookies.GetCookies([Uri]"${BaseUrl}/") | Where-Object { $_.Name -like "*session-token*" } | Select-Object -First 1
if (-not $sessionCookie) { Write-Host "  ❌ Login failed — no session cookie" -ForegroundColor Red; exit 1 }

$CookieJar[$sessionCookie.Name] = $sessionCookie.Value

# Verify session
$sessionInfo = Invoke-RestMethod -Uri "${BaseUrl}/api/auth/session" -WebSession $AuthSession -UseBasicParsing
if ($sessionInfo.user) {
    Write-Host "  ✅ Logged in as: $($sessionInfo.user.name) ($($sessionInfo.user.email))"
} else {
    Write-Host "  ❌ Session invalid" -ForegroundColor Red; exit 1
}

# ── 3. Get dynamic IDs from DB for URL construction ───────────────────────
Write-Host ""
Write-Host "── Fetching test IDs from DB ──"
$CustId = $null; $PetId = $null

try {
    $customers = Invoke-RestMethod -Uri "${BaseUrl}/api/customers?limit=1" -WebSession $AuthSession -UseBasicParsing
    $c = if ($customers.customers) { $customers.customers[0] } elseif ($customers -is [array]) { $customers[0] } else { $null }
    $CustId = $c?.id
    if ($CustId) {
        $custDetail = Invoke-RestMethod -Uri "${BaseUrl}/api/customers/${CustId}" -WebSession $AuthSession -UseBasicParsing
        $PetId = $custDetail.pets?[0]?.id
    }
} catch {}
# Fallback to known DB IDs if dynamic fetch fails
if (-not $CustId) {
    try {
        $allCust = Invoke-RestMethod -Uri "${BaseUrl}/api/customers" -WebSession $AuthSession -UseBasicParsing
        $c2 = if ($allCust.customers) { $allCust.customers[0] } elseif ($allCust -is [array]) { $allCust[0] } else { $null }
        $CustId = $c2?.id
        if ($CustId) {
            $cd2 = Invoke-RestMethod -Uri "${BaseUrl}/api/customers/${CustId}" -WebSession $AuthSession -UseBasicParsing
            $PetId = $cd2.pets?[0]?.id
        }
    } catch {}
}

if ($CustId) { Write-Host "  Customer: $CustId" }
if ($PetId)  { Write-Host "  Pet:      $PetId" }

# ── 4. Page tests ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── Page Tests ──"

$results = @()
$results += Invoke-Page "/"          "Dashboard (home)"
$results += Invoke-Page "/customers" "Customer list"
if ($CustId) {
    $results += Invoke-Page "/customers/${CustId}" "Customer detail"
    if ($PetId) {
        $results += Invoke-Page "/customers/${CustId}/pets/${PetId}" "Pet detail (P1 test)"
    }
}
$results += Invoke-Page "/appointments"        "Appointments"
$results += Invoke-Page "/reports"             "Reports (overview)"
$results += Invoke-Page "/reports?tab=income"  "Reports (income)"
$results += Invoke-Page "/reports?tab=receivables" "Reports (receivables)"
$results += Invoke-Page "/expenses"            "Expenses"
$results += Invoke-Page "/products"            "Products"
$results += Invoke-Page "/sales"               "Sales"

# ── 5. API tests ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "── API Tests ──"
$results += Invoke-Page "/api/auth/session"     "GET /api/auth/session"
$results += Invoke-Page "/api/customers?limit=1" "GET /api/customers"
$results += Invoke-Page "/api/services"         "GET /api/services"
$results += Invoke-Page "/api/staff"            "GET /api/staff"
$results += Invoke-Page "/api/expenses?month=2026-05" "GET /api/expenses"
$results += Invoke-Page "/api/reports?month=2026-05"  "GET /api/reports"

# ── 6. Summary ────────────────────────────────────────────────────────────
Write-Host ""
$ok   = ($results | Where-Object { $_ -eq 200 }).Count
$fail = $results.Count - $ok
$color = if ($fail -eq 0) { "Green" } else { "Red" }
Write-Host ("── Result: {0}/{1} passed ──" -f $ok, $results.Count) -ForegroundColor $color
if ($fail -gt 0) { exit 1 } else { exit 0 }
