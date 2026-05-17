# 前端启动排查：端口占用 + 后端健康检查（计划 diag-frontend-start）
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/diag-dev.ps1
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host '=== IntelliDesk dev diagnostics ===' -ForegroundColor Cyan

function Test-PortListen([int]$Port) {
  $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($c) {
    Write-Host "Port $Port : LISTEN (PID(s): $($c.OwningProcess -join ', '))" -ForegroundColor Yellow
    return $true
  }
  Write-Host "Port $Port : not listening" -ForegroundColor DarkGray
  return $false
}

Write-Host "`n[Ports]" -ForegroundColor Cyan
$null = Test-PortListen 5173
$null = Test-PortListen 4000
$null = Test-PortListen 4001

Write-Host "`n[Vite PC UI -> http://127.0.0.1:4000/]" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:4000/' -UseBasicParsing -TimeoutSec 8
  Write-Host "  HTTP $($r.StatusCode), length=$($r.RawContentLength) bytes" -ForegroundColor Green
  if ($r.StatusCode -eq 200 -and $r.RawContentLength -lt 200) {
    Write-Host "  WARN: body very small — may not be Vite (check PID on 4000)" -ForegroundColor Yellow
  }
} catch {
  Write-Host "  FAIL: $_" -ForegroundColor Red
  Write-Host "  -> From repo root: npm run dev:api (use http://127.0.0.1:4000)" -ForegroundColor DarkYellow
}

Write-Host "`n[Backend health -> http://127.0.0.1:4001/health]" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:4001/health' -UseBasicParsing -TimeoutSec 5
  Write-Host "  HTTP $($r.StatusCode): $($r.Content)" -ForegroundColor Green
} catch {
  Write-Host "  FAIL: $_" -ForegroundColor Red
  Write-Host "  -> Start: cd backend; npm run dev" -ForegroundColor DarkYellow
}

Write-Host "`n[If browser cannot open PC UI :4000]" -ForegroundColor Cyan
Write-Host "  1) Use http not https" -ForegroundColor White
Write-Host "  2) Try http://127.0.0.1:4000 before localhost (IPv6)" -ForegroundColor White
Write-Host "  3) Run npm run dev:api (mode=api), PC Vite uses port 4000" -ForegroundColor White
Write-Host "  4) White screen: demo login on login page; or wait for Firebase timeout" -ForegroundColor White
Write-Host "  5) LAN access: allow Node/Vite inbound; use host-LAN-IP:4000" -ForegroundColor White

Write-Host "`n[Env hints]" -ForegroundColor Cyan
Write-Host "  API dev: npm run dev:api -> http://localhost:4000 (proxy /api -> backend :4001)" -ForegroundColor White
Write-Host "  Mock:     npm run dev       -> http://127.0.0.1:5173（Windows 建议勿只用 localhost）" -ForegroundColor White
Write-Host "  登录:     使用登录页演示账号写入 mockUser；API 模式若 Firebase 卡住请等超时或清缓存" -ForegroundColor White
if (Test-Path -LiteralPath (Join-Path $root '.env.api')) {
  Write-Host "  .env.api present" -ForegroundColor Green
} else {
  Write-Host "  .env.api missing (dev:api 需要)" -ForegroundColor Yellow
}

Write-Host "`n[Smoke API script]" -ForegroundColor Cyan
Write-Host "  node scripts/smoke-intellidesk-api.mjs" -ForegroundColor White
