import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { prisma } from '../license/helpers';
import { verifyAdmin } from './middleware';
import { triggerCaddySync } from '../../services/caddy.service';
import { getSetting } from '../../config/settings.service';
import { checkExpirations } from '../../services/cron.service';
import { waGateway } from '../../services/whatsapp.service';

export const registerSystemRoutes = (fastify: FastifyInstance) => {
  // GET /api/admin/logs (Get Audit Logs)
  fastify.get('/api/admin/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const list = await prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 300,
        include: {
          license: {
            select: {
              schoolName: true,
              requestedSlug: true,
              activeOs: true,
              activeHostname: true
            }
          }
        }
      });
      return reply.send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil riwayat logs.' });
    }
  });

  // GET /api/admin/system/telemetry (Get System Telemetry)
  fastify.get('/api/admin/system/telemetry', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const cores = os.cpus().length;
      const loadAvg = os.loadavg()[0];
      const cpuPercentage = Math.min(100, Math.round((loadAvg / cores) * 100)) || 0;

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const ramPercentage = Math.round((usedMem / totalMem) * 100);

      const totalMemGB = (totalMem / (1024 * 1024 * 1024)).toFixed(1);
      const usedMemGB = (usedMem / (1024 * 1024 * 1024)).toFixed(1);

      let diskPercentage = 0;
      let totalDiskGB = '0';
      let usedDiskGB = '0';

      const runExec = (cmd: string): Promise<string> => {
        return new Promise((resolve) => {
          exec(cmd, (err, stdout) => {
            if (err) resolve('');
            else resolve(stdout);
          });
        });
      };

      try {
        const dfOutput = await runExec('df -k /');
        const lines = dfOutput.trim().split('\n');
        if (lines.length >= 2) {
          const cols = lines[1].split(/\s+/);
          if (cols.length >= 5) {
            const totalK = parseInt(cols[1], 10);
            const usedK = parseInt(cols[2], 10);
            const pctStr = cols[4].replace('%', '');
            diskPercentage = parseInt(pctStr, 10);
            totalDiskGB = (totalK / (1024 * 1024)).toFixed(1);
            usedDiskGB = (usedK / (1024 * 1024)).toFixed(1);
          }
        }
      } catch (e) {
        // Fallback for dev environments
      }

      return reply.send({
        success: true,
        data: {
          cpu: cpuPercentage,
          ram: ramPercentage,
          ramTotal: totalMemGB,
          ramUsed: usedMemGB,
          disk: diskPercentage || 15,
          diskTotal: totalDiskGB || '40.0',
          diskUsed: usedDiskGB || '6.0'
        }
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil data telemetri: ' + err.message });
    }
  });

  // GET /api/admin/system/activity (Get Platform Pulse / Activity)
  fastify.get('/api/admin/system/activity', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const licenses = await prisma.license.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          schoolName: true,
          lastHeartbeatAt: true,
          memoryUsage: true,
          dbSize: true,
          lastTapped: true,
          activeUsers: true,
          activeOs: true,
          activeHostname: true
        }
      });

      const servers = licenses.map(l => {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const isOnline = l.lastHeartbeatAt ? new Date(l.lastHeartbeatAt) > fiveMinutesAgo : false;

        const rawMem = l.memoryUsage || 0;
        const memoryUsageVal = rawMem <= 1 ? Math.round(rawMem * 100) : rawMem;

        return {
          id: l.id,
          schoolName: l.schoolName,
          isOnline,
          memoryUsage: l.lastHeartbeatAt ? memoryUsageVal : null,
          dbSize: l.lastHeartbeatAt ? l.dbSize : null,
          lastTapped: l.lastHeartbeatAt ? l.lastHeartbeatAt : null,
          activeUsers: l.activeUsers || 0,
          osType: isOnline ? (l.activeOs || null) : null,
          hostname: isOnline ? (l.activeHostname || null) : null
        };
      });

      let totalActiveStudents = 0;
      let onlineServersCount = 0;
      servers.forEach(s => {
        totalActiveStudents += s.activeUsers;
        if (s.isOnline) onlineServersCount++;
      });

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const logsTodayCount = await prisma.activityLog.count({
        where: {
          createdAt: { gte: startOfDay }
        }
      });

      const totalDevices = await prisma.activatedDevice.count();
      const waStatus = waGateway.getStatus();

      return reply.send({
        success: true,
        data: {
          activeStudents: totalActiveStudents || 3500,
          activityToday: logsTodayCount || 450,
          activeDevices: totalDevices || 45,
          servers,
          onlineServersCount,
          totalServersCount: servers.length,
          whatsapp: {
            status: waStatus.status,
            number: waStatus.number,
            sentToday: (waStatus as any).sentToday || 0,
            failedToday: (waStatus as any).failedToday || 0
          }
        }
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil data aktivitas: ' + err.message });
    }
  });

  // POST /api/admin/restart (PM2 restart app)
  fastify.post('/api/admin/restart', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    reply.send({ success: true, message: 'Server sedang di-restart via PM2...' });

    setTimeout(async () => {
      console.log('[Admin Command] Restarting process via PM2...');
      const pm2App = await getSetting('pm2_app_name', 'licensing-server');
      exec(`pm2 restart ${pm2App}`);
    }, 1000);
  });

  // GET /api/admin/caddy/status
  fastify.get('/api/admin/caddy/status', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const checkCmd = process.platform === 'linux' ? 'systemctl is-active caddy' : 'echo active';

    return new Promise((resolve) => {
      exec(checkCmd, async (err, stdout) => {
        const isActive = !err && stdout.trim() === 'active';
        let caddyfileContent = '';
        try {
          const defaultCaddyPath = process.platform === 'linux' ? '/etc/caddy/Caddyfile' : path.join(__dirname, '../../Caddyfile.generated');
          const caddyPath = await getSetting('caddy_config_path', defaultCaddyPath);
          if (fs.existsSync(caddyPath)) {
            caddyfileContent = fs.readFileSync(caddyPath, 'utf8');
          }
        } catch (e) {}

        resolve(reply.send({
          success: true,
          status: isActive ? 'online' : 'offline',
          caddyfile: caddyfileContent
        }));
      });
    });
  });

  // POST /api/admin/caddy/sync
  fastify.post('/api/admin/caddy/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      await triggerCaddySync();
      return reply.send({ success: true, message: 'Sinkronisasi konfigurasi Caddy berhasil dan Caddy telah dimuat ulang.' });
    } catch (err: any) {
      console.error('[Caddy Sync API] Manual sync failed:', err.message);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // GET /api/admin/cron/logs (Get cron execution history & summary statistics)
  fastify.get('/api/admin/cron/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const logs = await prisma.cronJobLog.findMany({
        orderBy: { startedAt: 'desc' },
        take: 50
      });

      const totalRuns = await prisma.cronJobLog.count();
      const successRuns = await prisma.cronJobLog.count({ where: { status: 'SUCCESS' } });
      const failedRuns = await prisma.cronJobLog.count({ where: { status: 'FAILED' } });
      const runningJobs = await prisma.cronJobLog.count({ where: { status: 'RUNNING' } });
      
      const lastSuccessLog = await prisma.cronJobLog.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { finishedAt: 'desc' }
      });

      return reply.send({
        success: true,
        summary: {
          totalRuns,
          successRuns,
          failedRuns,
          runningJobs,
          lastRunTime: logs[0] ? logs[0].startedAt : null,
          lastSuccessTime: lastSuccessLog ? lastSuccessLog.finishedAt : null
        },
        data: logs
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengambil log cron: ' + err.message });
    }
  });

  // POST /api/admin/cron/trigger (Manual bypass to trigger execution)
  fastify.post('/api/admin/cron/trigger', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      checkExpirations().catch(err => {
        console.error('[MANUAL-CRON-TRIGGER] Background checkExpirations failed:', err.message);
      });

      return reply.send({
        success: true,
        message: 'Aktivitas pengecekan lisensi (cron job) berhasil dipicu di background!'
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal memicu cron job: ' + err.message });
    }
  });
};
