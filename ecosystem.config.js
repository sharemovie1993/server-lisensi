module.exports = {
  apps: [
    {
      name: 'licensing-server',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,

      // ── Hardening: Cegah crash-restart loop ──────────────────────────────
      // Jika proses hidup < 5 detik, dianggap crash (bukan sehat)
      min_uptime: '5s',
      // Tunggu 4 detik sebelum restart — beri waktu OS lepaskan port
      restart_delay: 4000,
      // Maksimum 10 restart dalam window exp_backoff — setelah itu stop
      max_restarts: 10,
      // Beri waktu 8 detik untuk proses lama menutup port sebelum force-kill
      kill_timeout: 8000,
      // ─────────────────────────────────────────────────────────────────────

      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
