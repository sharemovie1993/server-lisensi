@echo off
TITLE Quick Deploy - Server Lisensi (VPS 103.196.155.87)
cd /d "%~dp0"

echo ==========================================================================
echo           QUICK DEPLOY - SERVER LISENSI (VPS 103.196.155.87)
echo ==========================================================================
echo.
echo Pilih metode deploy:
echo   [1] Git Pull + Restart di VPS (Rekomendasi - Cepat ^& Otomatis)
echo   [2] Local Build + SCP Upload (Tanpa Beban CPU di VPS)
echo   [0] Batal
echo.
set /p choice="Pilih opsi [1-2] (Default: 1): "

if "%choice%"=="" set choice=1
if "%choice%"=="0" exit /b 0

if "%choice%"=="2" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-fast.ps1"
    pause
    exit /b 0
)

echo.
echo [1/3] Memastikan kompilasi lokal valid...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Kompilasi TypeScript lokal gagal! Batalkan deploy.
    pause
    exit /b 1
)

echo.
echo [2/3] Menyinkronkan perubahan ke GitHub...
git add .
git diff-index --quiet HEAD
if %errorlevel% neq 0 (
    set /p commitMsg="Masukkan pesan commit (Default: 'update server-lisensi'): "
    if "%commitMsg%"=="" set commitMsg=update server-lisensi
    git commit -m "%commitMsg%"
    git push origin master
) else (
    echo Repositori lokal sudah sinkron dengan git.
    git push origin master
)

echo.
echo [3/3] Memperbarui dan merestart di VPS 103.196.155.87...
ssh -i "%~dp0ls-key.pem" -o StrictHostKeyChecking=no asepsuryadi@103.196.155.87 "cd /var/www/licensing-server && git pull origin master && npm run build && pm2 restart licensing-server"

echo.
echo ==========================================================================
echo   DEPLOY SUKSES! Server Lisensi telah aktif dengan pembaruan terbaru.
echo   URL: https://api.absenta.id
echo ==========================================================================
pause
