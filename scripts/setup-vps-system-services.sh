#!/bin/bash
# ==============================================================================
# setup-vps-system-services.sh
# Skrip Otomatisasi Instalasi Layanan Pendukung VPS Server Lisensi:
# 1. SNMP Monitoring (The Dude Server + Custom PM2 Probe)
# 2. SoftEther VPN Server (OpenVPN TCP 1194, SSTP TCP 4443, L2TP UDP 1701/500/4500)
# ==============================================================================

set -e

echo "=== [1/3] Memasang Paket Dependensi Sistem (SNMP & SoftEther) ==="
sudo apt-get update -y
sudo apt-get install -y snmpd snmp softether-vpnserver softether-vpncmd

# Hentikan daemon xl2tpd jika terpasang (agar tidak bentrok port UDP 1701 dengan SoftEther)
sudo systemctl stop xl2tpd 2>/dev/null || true
sudo systemctl disable xl2tpd 2>/dev/null || true

echo "=== [2/3] Mengonfigurasi Layanan SNMP (The Dude & PM2 Probe) ==="
# Probe script PM2 check
sudo tee /usr/local/bin/check_pm2_snmp.sh > /dev/null << 'EOF'
#!/bin/bash
PID=$(pgrep -f "licensing-server|license-server" | head -n 1)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:5001/ 2>/dev/null)

if [ -n "$PID" ] && [ "$HTTP_CODE" = "200" ]; then
    echo "OK: licensing-server online (PID: $PID, HTTP: $HTTP_CODE)"
    exit 0
else
    echo "CRITICAL: licensing-server down (PID: ${PID:-none}, HTTP: $HTTP_CODE)"
    exit 1
fi
EOF
sudo chmod +x /usr/local/bin/check_pm2_snmp.sh

# SNMP daemon config
sudo tee /etc/snmp/snmpd.conf > /dev/null << 'EOF'
# SNMP Configuration for Absenta License Server Monitoring (The Dude)
sysLocation    Server Lisensi Absenta
sysContact     admin@absenta.id
sysServices    72

# Listen on all interfaces on UDP port 161
agentAddress   udp:161,udp6:161

# Read-only community string (public)
rocommunity    public default
rocommunity6   public default

# Disk monitoring
includeAllDisks 10%

# Extend script for PM2 Licensing Server health check
extend pm2_license /usr/local/bin/check_pm2_snmp.sh

includeDir /etc/snmp/snmpd.conf.d
EOF

sudo systemctl enable snmpd
sudo systemctl restart snmpd
echo "SNMP berhasil dikonfigurasi dan berjalan di port UDP 161."

echo "=== [3/3] Mengonfigurasi Layanan SoftEther VPN Server ==="
sudo systemctl enable softether-vpnserver
sudo systemctl restart softether-vpnserver
sleep 2

# 1. Pastikan Virtual Hub DEFAULT aktif
vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /CMD HubCreate DEFAULT /PASSWORD:'' || true

# 2. Matikan Listener Port 443 (wajib agar tidak bentrok dengan Caddy SSL)
vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /CMD ListenerDisable 443 || true

# 3. Aktifkan Listener alternatif
vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /CMD ListenerCreate 4443 || true
vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /CMD ListenerCreate 1194 || true
vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /CMD ListenerCreate 992 || true

# 4. Aktifkan OpenVPN Server Function (TCP Mode Port 1194)
vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /CMD ProtoOptionsSet OpenVPN /NAME:Enabled /VALUE:True || true

# 5. Aktifkan L2TP & IPsec dengan Pre-Shared Key "absenta"
vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /CMD IPsecEnable /L2TP:yes /L2TPRAW:yes /ETHERIP:yes /PSK:absenta /DEFAULTHUB:DEFAULT || true

# 6. Aktifkan SecureNAT untuk Virtual Hub DEFAULT (Subnet 10.0.1.0/24)
vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /HUB:DEFAULT /CMD SecureNatEnable || true
vpncmd 127.0.0.1:5555 /SERVER /PASSWORD:'' /HUB:DEFAULT /CMD SecureNatHostSet /IP:10.0.1.1 /MASK:255.255.255.0 || true

echo "=== SEMUA LAYANAN PENDUKUNG (SNMP & VPN) TELAH BERHASIL DIKONFIGURASI ==="
