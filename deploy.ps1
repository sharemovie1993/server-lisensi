# deploy.ps1
# Upload project-server-lisensi files to VPS and restart PM2

$ErrorActionPreference = "Stop"
$VPS_IP = "103.129.148.127"
$VPS_USER = "asepsuryadi"
$PEM_KEY = "nginxonly.pem"
$REMOTE_BASE = "/var/www/licensing-server"

Write-Host "[BACKEND] Memulai Deploy Project-Server-Lisensi ke VPS..." -ForegroundColor Cyan

# Helper function to deploy a file
function Deploy-File($localPath, $remotePath) {
    Write-Host "[DEPLOY] Uploading $localPath..." -ForegroundColor Yellow
    scp -i $PEM_KEY -o StrictHostKeyChecking=no $localPath "${VPS_USER}@${VPS_IP}:/home/${VPS_USER}/temp_file.tmp"
    if ($LASTEXITCODE -ne 0) { throw "Upload $localPath gagal!" }
    
    ssh -i $PEM_KEY -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "sudo mv /home/${VPS_USER}/temp_file.tmp ${REMOTE_BASE}/${remotePath} && sudo chown root:root ${REMOTE_BASE}/${remotePath}"
    if ($LASTEXITCODE -ne 0) { throw "Gagal memindahkan $localPath ke remote!" }
}

try {
    # 1. Deploy Core Routes
    Deploy-File "routes/license.js" "routes/license.js"
    Deploy-File "routes/admin.js" "routes/admin.js"
    Deploy-File "server.js" "server.js"
    
    # 2. Deploy configs
    Deploy-File "config/db.js" "config/db.js"
    Deploy-File ".env" ".env"
    
    # 2b. Deploy Caddy sync scripts & utilities
    Deploy-File "scripts/sync-caddy.js" "scripts/sync-caddy.js"
    Deploy-File "utils/caddy.js" "utils/caddy.js"
    
    # 3. Deploy Views & Assets
    Deploy-File "views/invoice-template.js" "views/invoice-template.js"
    Deploy-File "public/admin.html" "public/admin.html"
    Deploy-File "public/admin.js" "public/admin.js"
    Deploy-File "public/modules/admin-render.js" "public/modules/admin-render.js"
    
    # 4. Restart PM2 service
    Write-Host "[BACKEND] Merestart PM2 licensing-server di VPS..." -ForegroundColor Yellow
    ssh -i $PEM_KEY -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "sudo pm2 restart licensing-server --update-env && sudo pm2 save"
    if ($LASTEXITCODE -ne 0) { throw "Restart PM2 gagal!" }
    Write-Host "[BACKEND] PM2 licensing-server berhasil direstart!" -ForegroundColor Green
    
    # 5. Isolation Firewall setup
    Write-Host "[BACKEND] Mengonfigurasi Aturan Isolasi Firewall VPN di VPS..." -ForegroundColor Yellow
    ssh -i $PEM_KEY -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "sudo iptables -D FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable 2>/dev/null; sudo iptables -D FORWARD -i wg0 -o wg0 -m iprange --dst-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable 2>/dev/null; sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable && sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --dst-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable && if [ -d /etc/iptables ]; then sudo sh -c 'iptables-save > /etc/iptables/rules.v4'; fi"
    
    Write-Host "[BACKEND] DEPLOY BACKEND BERHASIL & LIVE!" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] $_" -ForegroundColor Red
    exit 1
}
