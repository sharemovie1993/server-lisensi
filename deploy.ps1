# deploy.ps1 - Wizard Deploy Server Lisensi ke VPS
# Menggunakan git pull di VPS (bukan SCP file per file)
# Untuk Windows PowerShell

$ErrorActionPreference = "Stop"

try {
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force -ErrorAction SilentlyContinue
} catch {}

function Show-Header {
    param ($StepTitle)
    Clear-Host
    Write-Host "==========================================================================" -ForegroundColor Cyan
    Write-Host "         WIZARD DEPLOY - SERVER LISENSI (LICENSING SERVER VPS)            " -ForegroundColor Yellow
    Write-Host "==========================================================================" -ForegroundColor Cyan
    if ($StepTitle) {
        Write-Host " [Langkah] $StepTitle" -ForegroundColor Green
        Write-Host "--------------------------------------------------------------------------" -ForegroundColor Gray
    }
}

# -----------------------------------------------
# LANGKAH 0: Selamat Datang
# -----------------------------------------------
Show-Header
Write-Host "Wizard ini akan men-deploy kode terbaru dari GitHub ke VPS Licensing Server." -ForegroundColor White
Write-Host ""
Write-Host "Proses ini mencakup:"
Write-Host " 1. Pemeriksaan koneksi ke VPS"
Write-Host " 2. Git pull (fetch + reset --hard) di VPS"
Write-Host " 3. Restart proses Node.js (licensing server)"
Write-Host " 4. Jalankan sync Caddy agar routing terbaru aktif"
Write-Host ""
Write-Host "Tekan [Y] untuk melanjutkan, atau tombol lain untuk keluar."
$key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
if ($key.Character -ne 'y' -and $key.Character -ne 'Y') {
    Write-Host "Deploy dibatalkan." -ForegroundColor Red
    Exit
}

# -----------------------------------------------
# LANGKAH 1: Konfigurasi VPS
# -----------------------------------------------
Show-Header "1 / 4 - Konfigurasi Koneksi VPS"

# Default dari .env jika ada
$VPS_IP      = "103.129.148.127"
$VPS_USER    = "asepsuryadi"
$VPS_PEM     = "nginxonly.pem"
$REMOTE_DIR  = "/var/www/licensing-server"
$REMOTE_BRANCH = "master"

# Cek apakah file .pem ada
$pemCandidates = @(
    (Join-Path $PSScriptRoot "nginxonly.pem"),
    (Join-Path $PSScriptRoot "..\deployer\nginxonly.pem"),
    "nginxonly.pem"
)
foreach ($pem in $pemCandidates) {
    if (Test-Path $pem) { $VPS_PEM = $pem; break }
}

Write-Host "Konfigurasi VPS:"
Write-Host " - IP VPS       : $VPS_IP"
Write-Host " - User         : $VPS_USER"
Write-Host " - PEM Key      : $VPS_PEM"
Write-Host " - Remote Dir   : $REMOTE_DIR"
Write-Host " - Branch       : $REMOTE_BRANCH"
Write-Host ""

$inIp = Read-Host "IP VPS [$VPS_IP]"
if (-not [string]::IsNullOrWhiteSpace($inIp)) { $VPS_IP = $inIp }

$inUser = Read-Host "Username SSH [$VPS_USER]"
if (-not [string]::IsNullOrWhiteSpace($inUser)) { $VPS_USER = $inUser }

$inPem = Read-Host "Path file PEM key [$VPS_PEM]"
if (-not [string]::IsNullOrWhiteSpace($inPem)) { $VPS_PEM = $inPem }

$inBranch = Read-Host "Branch GitHub [$REMOTE_BRANCH]"
if (-not [string]::IsNullOrWhiteSpace($inBranch)) { $REMOTE_BRANCH = $inBranch }

if (-not (Test-Path $VPS_PEM)) {
    Write-Host "ERROR: File PEM key tidak ditemukan di: $VPS_PEM" -ForegroundColor Red
    Read-Host "Tekan [ENTER] untuk keluar..."
    Exit
}

# -----------------------------------------------
# LANGKAH 2: Test Koneksi SSH
# -----------------------------------------------
Show-Header "2 / 4 - Uji Koneksi SSH ke VPS"
Write-Host "Menguji koneksi SSH ke $VPS_IP..." -ForegroundColor Yellow

try {
    $sshTest = ssh -i $VPS_PEM -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${VPS_USER}@${VPS_IP}" "echo 'SSH_OK'"
    if ($sshTest -notmatch "SSH_OK") { throw "Respons tidak valid" }
    Write-Host "Koneksi SSH berhasil!" -ForegroundColor Green
} catch {
    Write-Host "GAGAL: Tidak dapat terhubung ke VPS via SSH!" -ForegroundColor Red
    Write-Host "Pastikan VPS aktif, IP benar, dan file PEM valid." -ForegroundColor Yellow
    Read-Host "Tekan [ENTER] untuk keluar..."
    Exit
}
Write-Host ""

# Cek apakah folder repo ada di VPS
Write-Host "Memeriksa repository di VPS..." -ForegroundColor Yellow
$repoCheck = ssh -i $VPS_PEM -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "test -d $REMOTE_DIR/.git && echo 'EXISTS' || echo 'MISSING'"
if ($repoCheck -match "MISSING") {
    Write-Host "ERROR: Folder $REMOTE_DIR tidak ditemukan atau bukan git repo di VPS!" -ForegroundColor Red
    Write-Host "Pastikan licensing server sudah pernah di-clone di VPS terlebih dahulu." -ForegroundColor Yellow
    Read-Host "Tekan [ENTER] untuk keluar..."
    Exit
}
Write-Host "Repository ditemukan di VPS." -ForegroundColor Green
Write-Host ""
Read-Host "Tekan [ENTER] untuk memulai deploy..."

# -----------------------------------------------
# LANGKAH 3: Git Pull di VPS
# -----------------------------------------------
Show-Header "3 / 4 - Memperbarui Kode di VPS (git fetch + reset)"
Write-Host "Menjalankan git fetch dan reset --hard di VPS..." -ForegroundColor Yellow

try {
    $gitOut = ssh -i $VPS_PEM -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "cd $REMOTE_DIR && sudo git fetch origin && sudo git reset --hard origin/$REMOTE_BRANCH && echo 'GIT_OK'"
    Write-Host $gitOut
    if ($gitOut -notmatch "GIT_OK") { throw "Git pull tidak menghasilkan output yang diharapkan" }
    Write-Host "Kode berhasil diperbarui ke versi terbaru!" -ForegroundColor Green
} catch {
    Write-Host "GAGAL: $_" -ForegroundColor Red
    Read-Host "Tekan [ENTER] untuk keluar..."
    Exit
}

# Install dependencies jika ada perubahan package.json
Write-Host ""
Write-Host "Memperbarui dependensi Node.js di VPS (npm install)..." -ForegroundColor Yellow
ssh -i $VPS_PEM -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "cd $REMOTE_DIR && sudo npm install --production 2>&1 | tail -5"
Write-Host "Dependensi OK." -ForegroundColor Green
Write-Host ""
Read-Host "Tekan [ENTER] untuk restart layanan..."

# -----------------------------------------------
# LANGKAH 4: Restart Proses & Sync Caddy
# -----------------------------------------------
Show-Header "4 / 4 - Restart Layanan & Sync Caddy"

# Cari PID proses node licensing server
Write-Host "Mencari proses licensing server di VPS..." -ForegroundColor Yellow
$pidInfo = ssh -i $VPS_PEM -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "sudo ss -tulpn | grep ':5001' | grep -oP 'pid=\K[0-9]+' | head -1"

if ($pidInfo -match "^\d+$") {
    Write-Host "Proses ditemukan (PID: $pidInfo). Merestart dengan SIGHUP..." -ForegroundColor Yellow
    ssh -i $VPS_PEM -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "sudo kill -HUP $pidInfo"
    Start-Sleep -Seconds 3
    # Verifikasi masih berjalan
    $newPid = ssh -i $VPS_PEM -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "sudo ss -tulpn | grep ':5001' | grep -oP 'pid=\K[0-9]+' | head -1"
    if ($newPid -match "^\d+$") {
        Write-Host "Licensing server berhasil direstart! (PID baru: $newPid)" -ForegroundColor Green
    } else {
        Write-Host "PERINGATAN: Proses tidak ditemukan setelah restart. Coba start manual." -ForegroundColor Yellow
        ssh -i $VPS_PEM -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "cd $REMOTE_DIR && sudo node server.js &"
    }
} else {
    Write-Host "Proses licensing server tidak berjalan di port 5001. Mencoba start..." -ForegroundColor Yellow
    ssh -i $VPS_PEM -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "cd $REMOTE_DIR && sudo nohup node server.js > /var/log/licensing-server.log 2>&1 &"
    Start-Sleep -Seconds 2
    Write-Host "Licensing server dimulai." -ForegroundColor Green
}

# Sync Caddy
Write-Host ""
Write-Host "Menjalankan sync Caddy untuk memperbarui routing..." -ForegroundColor Yellow
$syncOut = ssh -i $VPS_PEM -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "cd $REMOTE_DIR && sudo node scripts/sync-caddy.js 2>&1 | tail -5"
Write-Host $syncOut
Write-Host "Sync Caddy selesai." -ForegroundColor Green

# -----------------------------------------------
# SELESAI
# -----------------------------------------------
Show-Header "Deploy Berhasil!"
Write-Host "Server Lisensi berhasil diperbarui dan layanan sudah aktif kembali!" -ForegroundColor Green
Write-Host ""
Write-Host "Info Server:" -ForegroundColor Yellow
Write-Host " - Endpoint API   : https://api.absenta.id"
Write-Host " - Admin Dashboard: https://api.absenta.id/admin"
Write-Host ""
Write-Host "Untuk deploy ulang berikutnya, cukup jalankan skrip ini lagi." -ForegroundColor Gray
Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Cyan
Read-Host "Tekan [ENTER] untuk keluar..."
