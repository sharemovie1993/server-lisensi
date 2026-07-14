# GLOBAL RULES

Database Constraint (PostgreSQL-Only):
- **Depresiasi SQLite**: SQLite telah sepenuhnya dinonaktifkan. Seluruh query database wajib menggunakan adapter PostgreSQL (via Prisma ORM untuk server, atau `pg` pool untuk skrip otomasi). Dilarang menyertakan pustaka atau database `sqlite3` baru di dalam repositori.

License Integrity & Security:
- **Asymmetric Signature Guard**: Kunci rahasia `private_key.pem` wajib disimpan dengan ketat di server lisensi pusat dan dilarang disebarkan ke klien. Modifikasi data lisensi wajib disertai dengan penerbitan ulang tanda tangan JWT RS256 yang valid.
- **Hardware ID (HWID) Fingerprint Binding**: Aktivasi perangkat baru wajib mencocokkan total perangkat terdaftar di tabel `activated_devices` terhadap batasan `device_limit` lisensi induk. Aktivasi yang melebihi kuota wajib ditolak dengan respons HTTP 400.
- **Auditing Trail**: Setiap kejadian aktivasi lisensi, request heartbeat, modifikasi subdomain, dan kegagalan verifikasi wajib dicatat ke tabel `activity_logs` dengan IP Publik pengirim.

Financial & Webhook Rules:
- **HMAC Signature Check**: Webhook callback dari Tripay/Xendit wajib melewati pengecekan signature HMAC-SHA256 yang sah (`TRIPAY_PRIVATE_KEY` / `XENDIT_CALLBACK_TOKEN`) sebelum memicu mutasi status invoice menjadi `PAID` atau memperpanjang langganan.
- **Transactional Safety**: Pengaktifan lisensi dan perpanjangan langganan paket wajib menggunakan transaksi database terisolasi untuk menghindari inkonsistensi billing.

Infrastructure Rules:
- **Strict VPN Isolation Policy**: Aturan iptables di interface `wg0` untuk memblokir lalu lintas client-to-client wajib dipasang dan diuji secara berkala oleh server untuk mencegah serangan peretasan lintas sekolah di jaringan VPN internal.
- **On-Demand TLS Validation**: API `/api/public/validate-domain` wajib bersifat fail-closed (mengembalikan 403 jika query gagal atau database error) guna melindungi sistem dari eksploitasi domain liar.
