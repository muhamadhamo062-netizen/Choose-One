# Run from project root:  powershell -ExecutionPolicy Bypass -File scripts/start-postgres-windows.ps1
# Or right-click "Run with PowerShell" (may need admin for Start-Service)
$ErrorActionPreference = "Stop"
# Script lives in project/scripts → project root is one level up
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not (Test-Path (Join-Path $root "package.json"))) {
  Write-Host "package.json not found; cwd=$root"
  exit 1
}
Set-Location $root
Write-Host "Project: $root"

# 1) Try Windows PostgreSQL service
$svc = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "postgres" } | Select-Object -First 1
if ($svc) {
  Write-Host "Found service: $($svc.Name)  Status: $($svc.Status)"
  if ($svc.Status -ne "Running") {
    try {
      Start-Service -Name $svc.Name
      Start-Sleep -Seconds 2
      Write-Host "Started service: $($svc.Name)"
    } catch {
      Write-Host "Could not start service (try running PowerShell as Administrator): $_"
    }
  }
} else {
  Write-Host "No Windows service name matching *postgres* found."
}

# 2) If Docker available, start compose stack (port 5432)
$hasDocker = $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
if ($hasDocker) {
  Write-Host "Running: docker compose -f docker-compose.dev.yml up -d"
  docker compose -f (Join-Path $root "docker-compose.dev.yml") up -d
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker compose failed (install Docker Desktop or ignore if you use native Postgres)."
  } else {
    Write-Host "Waiting 5s for PostgreSQL to accept connections..."
    Start-Sleep -Seconds 5
  }
} else {
  Write-Host "docker not in PATH; skipped docker compose."
}

# 3) Prisma: generate, ensure db, push, ping
Write-Host "Running: npm run db:ready"
& npm run db:ready
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done."
exit 0
