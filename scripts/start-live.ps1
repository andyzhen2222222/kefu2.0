# Docker Postgres -> migrate -> seed (start Docker Desktop first)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
Set-Location $backend

Write-Host ">>> docker compose up -d postgres"
docker compose up -d postgres
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "[FAIL] Docker not available. Start Docker Desktop, then run: npm run intellidesk:setup-db" -ForegroundColor Red
  exit 1
}

Write-Host ">>> wait for PostgreSQL..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  docker compose exec -T postgres pg_isready -U intellidesk 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 1
}
if (-not $ready) {
  Write-Host "[FAIL] PostgreSQL not ready in 60s" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path (Join-Path $backend ".env"))) {
  Copy-Item (Join-Path $backend ".env.example") (Join-Path $backend ".env")
}

Write-Host ">>> prisma migrate deploy"
npm run db:migrate
Write-Host ">>> prisma seed"
npm run db:seed

Write-Host ""
Write-Host "[OK] Database ready. Run in two terminals:" -ForegroundColor Green
Write-Host "  1) cd backend && npm run dev   (API http://localhost:4000)"
Write-Host "  2) cd repo root && npm run dev:api   (UI http://localhost:4001 → 代理到 4000)"
