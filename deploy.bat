@echo off
TITLE Quick Deploy - Server Lisensi (VPS 103.196.155.87)
cd /d "%~dp0"

echo ==========================================================================
echo           QUICK DEPLOY - SERVER LISENSI (VPS 103.196.155.87)
echo     [STANDAR WAJIB]: BUILD DI LOKAL (Mencegah Lonjakan CPU 100% VPS)
echo ==========================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-fast.ps1"
pause
