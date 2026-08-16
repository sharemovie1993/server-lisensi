# deploy-fast.ps1 - Deploy Ringan (Build Lokal + Upload SCP Fast)
# Mencegah lonjakan CPU 100% di VPS karena build tsc & vite dilakukan di komputer lokal.

$ErrorActionPreference = "Stop"

$VPS_IP     = "103.196.155.87"
$VPS_USER   = "asepsuryadi"
$VPS_PEM    = "ls-key.pem"
$REMOTE_DIR = "/var/www/licensing-server"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "    DEPLOY CEPAT VIA LOCAL BUILD + SCP UPLOAD (SERVER LISENSI VPS)       " -ForegroundColor Yellow
Write-Host "==========================================================================" -ForegroundColor Cyan

# 1. BUILD LOKAL
Write-Host "`n[1/4] Membangun (Build) Backend & Frontend di Komputer Lokal..." -ForegroundColor Green
try {
    Write-Host " - Compiling TypeScript Backend (dist)..." -ForegroundColor Gray
    npm run build
    Write-Host " - Compiling Vite Platform Panel (public)..." -ForegroundColor Gray
    npm --prefix platform-panel run build
    Write-Host "Build lokal BERHASIL!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Gagal melakukan build lokal!" -ForegroundColor Red
    Exit 1
}

# 2. KOMPRES HASIL BUILD LOKAL
Write-Host "`n[2/4] Mengompresi hasil build ke release_dist.tar.gz..." -ForegroundColor Green
if (Test-Path "release_dist.tar.gz") { Remove-Item "release_dist.tar.gz" -Force }
tar -czf release_dist.tar.gz dist public prisma package.json ecosystem.config.js src scripts
Write-Host "File arsip siap dikirim." -ForegroundColor Green

# 3. UPLOAD VIA SCP
Write-Host "`n[3/4] Mengunggah (SCP) release_dist.tar.gz ke VPS $VPS_IP..." -ForegroundColor Green
try {
    scp -i $VPS_PEM -o StrictHostKeyChecking=no release_dist.tar.gz "${VPS_USER}@${VPS_IP}:${REMOTE_DIR}/release_dist.tar.gz"
    Write-Host "Unggah file berhasil!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Gagal mengunggah file via SCP ke VPS!" -ForegroundColor Red
    Exit 1
}

# 4. EKSTRAKSI & RESTART PM2 DI VPS
Write-Host "`n[4/4] Meng-ekstrak & merestart PM2 di VPS (Tanpa Build di VPS)..." -ForegroundColor Green
$remoteCmd = "cd $REMOTE_DIR && sudo tar -xzf release_dist.tar.gz && npx prisma db push && npx prisma generate && pm2 restart licensing-server"
try {
    ssh -i $VPS_PEM -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" $remoteCmd
    Write-Host "`n==========================================================================" -ForegroundColor Cyan
    Write-Host " SUCCESS! Deploy selesai tanpa membebani CPU VPS!" -ForegroundColor Green
    Write-Host " Endpoint API   : https://api.absenta.id" -ForegroundColor Yellow
    Write-Host " Admin Console : https://api.absenta.id/admin" -ForegroundColor Yellow
    Write-Host "==========================================================================" -ForegroundColor Cyan
} catch {
    Write-Host "ERROR: Gagal mengekstrak atau merestart PM2 di VPS!" -ForegroundColor Red
    Exit 1
} finally {
    if (Test-Path "release_dist.tar.gz") { Remove-Item "release_dist.tar.gz" -Force }
}
