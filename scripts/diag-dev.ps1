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
$null = Test-PortListen 3000
$null = Test-PortListen 4000
$null = Test-PortListen 4001

Write-Host "`n[Vite UI -> http://127.0.0.1:4001/]" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:4001/' -UseBasicParsing -TimeoutSec 8
  Write-Host "  HTTP $($r.StatusCode), length=$($r.RawContentLength) bytes" -ForegroundColor Green
  if ($r.StatusCode -eq 200 -and $r.RawContentLength -lt 200) {
    Write-Host "  WARN: body very small — may not be Vite (check PID on 4001)" -ForegroundColor Yellow
  }
} catch {
  Write-Host "  FAIL: $_" -ForegroundColor Red
  Write-Host "  -> 在项目根执行: npm run dev:api（勿用 https://；优先试 http://127.0.0.1:4001）" -ForegroundColor DarkYellow
}

Write-Host "`n[Backend health -> http://127.0.0.1:4000/health]" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:4000/health' -UseBasicParsing -TimeoutSec 5
  Write-Host "  HTTP $($r.StatusCode): $($r.Content)" -ForegroundColor Green
} catch {
  Write-Host "  FAIL: $_" -ForegroundColor Red
  Write-Host "  -> Start: cd backend; npm run dev" -ForegroundColor DarkYellow
}

Write-Host "`n[若浏览器打不开 4001]" -ForegroundColor Cyan
Write-Host "  1) 地址用 http 不要用 https" -ForegroundColor White
Write-Host "  2) 先试 http://127.0.0.1:4001 再试 localhost（排除 IPv6/解析问题）" -ForegroundColor White
Write-Host "  3) 必须 npm run dev:api（带 mode=api），否则 4001 可能未启动或行为不同" -ForegroundColor White
Write-Host "  4) 白屏/转圈：登录页点演示登录；或等 Firebase 超时后再登录" -ForegroundColor White
Write-Host "  5) 手机/局域网访问本机：防火墙需允许 Node/Vite 入站，地址用本机局域网 IP:4001" -ForegroundColor White

Write-Host "`n[Env hints]" -ForegroundColor Cyan
Write-Host "  API 联调: npm run dev:api  -> http://localhost:4001 (proxy /api -> 4000)" -ForegroundColor White
Write-Host "  Mock:     npm run dev       -> http://localhost:3000" -ForegroundColor White
Write-Host "  登录:     使用登录页演示账号写入 mockUser；API 模式若 Firebase 卡住请等超时或清缓存" -ForegroundColor White
if (Test-Path -LiteralPath (Join-Path $root '.env.api')) {
  Write-Host "  .env.api present" -ForegroundColor Green
} else {
  Write-Host "  .env.api missing (dev:api 需要)" -ForegroundColor Yellow
}

Write-Host "`n[Smoke API script]" -ForegroundColor Cyan
Write-Host "  node scripts/smoke-intellidesk-api.mjs" -ForegroundColor White
