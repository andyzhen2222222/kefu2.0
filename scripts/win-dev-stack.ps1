# Local dev: Docker Postgres 5433 + prisma db push + db seed
# Run from repo root: npm run dev:stack
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Test-DockerEngine {
  # docker writes to stderr on failure; with $ErrorActionPreference Stop that becomes terminating
  $prevEa = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  try {
    $null = & docker info 2>&1
    return ($LASTEXITCODE -eq 0)
  } finally {
    $ErrorActionPreference = $prevEa
  }
}

function Start-DockerDesktopIfPresent {
  $candidates = @(
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
  )
  foreach ($p in $candidates) {
    if (Test-Path -LiteralPath $p) {
      Write-Host ">>> Start Docker Desktop: $p" -ForegroundColor Cyan
      Start-Process -FilePath $p -ErrorAction SilentlyContinue
      return $true
    }
  }
  return $false
}

Write-Host '>>> Check Docker engine' -ForegroundColor Cyan
if (-not (Test-DockerEngine)) {
  Write-Host 'Engine not ready, try to launch Docker Desktop...' -ForegroundColor Yellow
  $launched = Start-DockerDesktopIfPresent
  if (-not $launched) {
    Write-Host 'Docker Desktop not found. Install it or install PostgreSQL and set backend/.env DATABASE_URL.' -ForegroundColor Red
    exit 1
  }
  $deadline = (Get-Date).AddMinutes(4)
  Write-Host 'Waiting for Docker (max ~4 min)...' -ForegroundColor Yellow
  while ((Get-Date) -lt $deadline) {
    if (Test-DockerEngine) {
      Write-Host 'Docker is ready.' -ForegroundColor Green
      break
    }
    Start-Sleep -Seconds 4
  }
  if (-not (Test-DockerEngine)) {
    Write-Host 'Timeout. Open Docker Desktop manually, then run npm run dev:stack again.' -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host 'Docker OK.' -ForegroundColor Green
}

Write-Host '>>> docker compose up postgres (port 5433)' -ForegroundColor Cyan
Set-Location "$root\backend"
docker compose up -d postgres
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Start-Sleep -Seconds 4

Write-Host '>>> npx prisma db push' -ForegroundColor Cyan
npx prisma db push --accept-data-loss
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '>>> npm run db:seed' -ForegroundColor Cyan
npm run db:seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location $root
Write-Host ''
Write-Host 'Done. Next:' -ForegroundColor Green
Write-Host '  1) cd backend && npm run dev   (API port 4000)' -ForegroundColor White
Write-Host '  2) npm run dev:api             (UI port 4001)' -ForegroundColor White
Write-Host '  3) Browser http://localhost:4001/ dashboard Retry' -ForegroundColor White
