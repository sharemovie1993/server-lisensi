"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTenantRoutes = void 0;
const crypto_1 = __importDefault(require("crypto"));
const helpers_1 = require("../license/helpers");
const middleware_1 = require("./middleware");
const caddy_service_1 = require("../../services/caddy.service");
const settings_service_1 = require("../../config/settings.service");
const whatsapp_service_1 = require("../../services/whatsapp.service");
const logger_1 = require("../../utils/logger");
const registerTenantRoutes = (fastify) => {
    // GET /api/admin/tenants (List active tenants with modules and schools)
    fastify.get('/api/admin/tenants', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const [list, subscriptions, paidInvoices] = await Promise.all([
                helpers_1.prisma.license.findMany({
                    include: {
                        activatedDevices: true
                    },
                    orderBy: { createdAt: 'desc' }
                }),
                helpers_1.prisma.subscription.findMany({
                    where: { status: 'active' },
                    select: { licenseId: true, productId: true, schoolName: true }
                }),
                helpers_1.prisma.invoice.findMany({
                    where: { status: { in: ['paid', 'PAID'] } },
                    select: { licenseId: true }
                })
            ]);
            const paidLicenseIds = new Set(paidInvoices.map(inv => inv.licenseId));
            const subscriptionMap = new Map();
            for (const sub of subscriptions) {
                if (!subscriptionMap.has(sub.licenseId)) {
                    subscriptionMap.set(sub.licenseId, []);
                }
                const parts = sub.schoolName.split('|');
                subscriptionMap.get(sub.licenseId).push({
                    productId: sub.productId,
                    name: parts[0].trim(),
                    subdomain: parts[1] ? parts[1].trim() : null
                });
            }
            const enrichedTenants = list.map(t => {
                const licenseSubs = subscriptionMap.get(t.id) || [];
                const seen = new Set();
                const uniqueSchools = [];
                for (const s of licenseSubs) {
                    if (!s.name || seen.has(s.name))
                        continue;
                    seen.add(s.name);
                    uniqueSchools.push({ name: s.name, subdomain: s.subdomain });
                }
                const modules = licenseSubs.map(s => s.productId);
                const isTrial = !paidLicenseIds.has(t.id);
                return {
                    id: t.id,
                    name: t.schoolName,
                    schoolName: t.schoolName,
                    domain_or_slug: t.requestedSlug,
                    requestedSlug: t.requestedSlug,
                    license_key: t.licenseKey,
                    licenseKey: t.licenseKey,
                    created_at: t.createdAt,
                    createdAt: t.createdAt,
                    isActive: t.isActive,
                    status: t.status,
                    is_trial: isTrial,
                    productId: (0, helpers_1.normalizeProductId)(t.productId),
                    custom_domain: t.customDomain,
                    lastHeartbeatAt: t.lastHeartbeatAt,
                    deployMode: t.deployMode,
                    wireguardIp: t.wireguardIp,
                    activeUsers: t.activeUsers,
                    dbSize: t.dbSize,
                    memoryUsage: t.memoryUsage,
                    lastTapped: t.lastTapped,
                    hostname: t.activeHostname,
                    osType: t.activeOs,
                    modules: modules,
                    schools: uniqueSchools.length > 0 ? uniqueSchools : [{ name: t.schoolName, subdomain: t.requestedSlug || null }],
                    activeDevices: t.activatedDevices.length,
                    activatedDevices: t.activatedDevices.map(d => ({
                        id: d.id,
                        deviceId: d.deviceId,
                        activatedAt: d.activatedAt.toISOString()
                    })),
                    license_details: {
                        status: t.status,
                        expires_at: t.expiresAt,
                        is_active: t.isActive
                    }
                };
            });
            return reply.send({ success: true, count: enrichedTenants.length, data: enrichedTenants });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar tenant: ' + err.message });
        }
    });
    // POST /api/admin/tenants (Manual tenant/school registration - frontend compatibility)
    fastify.post('/api/admin/tenants', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { schoolName, requestedSlug, packageId } = request.body;
        if (!schoolName || !requestedSlug || !packageId) {
            return reply.status(400).send({ success: false, message: 'Nama sekolah, slug, dan produk wajib diisi.' });
        }
        try {
            const targetProductId = (0, helpers_1.normalizeProductId)(packageId);
            const product = await helpers_1.prisma.product.findUnique({ where: { id: targetProductId } });
            if (!product) {
                return reply.status(404).send({ success: false, message: 'Produk tidak ditemukan.' });
            }
            const generateKey = (prefix) => {
                const rand = crypto_1.default.randomBytes(8).toString('hex').toUpperCase();
                return `${prefix}-${rand.slice(0, 4)}-${rand.slice(4, 8)}-${rand.slice(8, 12)}`;
            };
            const key = generateKey(product.prefix);
            const license = await helpers_1.prisma.license.create({
                data: {
                    licenseKey: key,
                    productId: targetProductId,
                    schoolName: schoolName.trim(),
                    deviceLimit: 1, // Default limit
                    isUnlimited: 0,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                    status: 'active',
                    isActive: 1,
                    requestedSlug: requestedSlug.trim().toLowerCase(),
                }
            });
            // Seed dynamic routing configuration if slug exists
            await (0, caddy_service_1.triggerCaddySync)();
            return reply.status(201).send({
                success: true,
                message: 'Tenant berhasil didaftarkan secara manual.',
                data: license
            });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mendaftarkan tenant: ' + err.message });
        }
    });
    // GET /api/admin/nodes (Get active infrastructure server & tunnel nodes)
    fastify.get('/api/admin/nodes', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const list = await helpers_1.prisma.license.findMany({
                where: {
                    productId: { in: ['cakola', 'easy-tunnel'] }
                },
                include: {
                    activatedDevices: true
                },
                orderBy: { createdAt: 'desc' }
            });
            const mapped = list.map(t => ({
                id: t.id,
                schoolName: t.schoolName,
                requestedSlug: t.requestedSlug,
                licenseKey: t.licenseKey,
                status: t.status,
                lastHeartbeatAt: t.lastHeartbeatAt,
                deployMode: t.deployMode,
                activeUsers: t.activeUsers,
                dbSize: t.dbSize,
                memoryUsage: t.memoryUsage,
                lastTapped: t.lastTapped,
                wireguardIp: t.wireguardIp,
                is_trial: t.status === 'active' && t.isActive === 1 && !t.planId,
                hostname: t.activeHostname,
                osType: t.activeOs,
                activeDevices: t.activatedDevices.length,
                createdAt: t.createdAt
            }));
            return reply.send({ success: true, count: mapped.length, data: mapped });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar server node: ' + err.message });
        }
    });
    // POST /api/license/generate (Generate new license key manually)
    fastify.post('/api/license/generate', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { school_name, device_limit, expires_at, product_id, is_unlimited, requested_slug, include_vpn, wireguard_ip } = request.body;
        if (!school_name || !product_id || !expires_at) {
            return reply.status(400).send({ success: false, message: 'Parameter school_name, product_id, dan expires_at wajib diisi.' });
        }
        try {
            const targetProductId = (0, helpers_1.normalizeProductId)(product_id);
            const product = await helpers_1.prisma.product.findUnique({ where: { id: targetProductId } });
            if (!product) {
                return reply.status(404).send({ success: false, message: 'Produk tidak ditemukan.' });
            }
            const generateKey = (prefix) => {
                const rand = crypto_1.default.randomBytes(8).toString('hex').toUpperCase();
                return `${prefix}-${rand.slice(0, 4)}-${rand.slice(4, 8)}-${rand.slice(8, 12)}`;
            };
            const key = generateKey(product.prefix);
            const license = await helpers_1.prisma.license.create({
                data: {
                    licenseKey: key,
                    productId: targetProductId,
                    schoolName: school_name.trim(),
                    deviceLimit: device_limit || 0,
                    isUnlimited: is_unlimited ? 1 : 0,
                    expiresAt: expires_at,
                    status: 'active',
                    isActive: 1,
                    requestedSlug: requested_slug ? requested_slug.trim().toLowerCase() : null,
                    includeVpn: include_vpn ? 1 : 0,
                    wireguardIp: wireguard_ip || null
                }
            });
            if (requested_slug) {
                await (0, caddy_service_1.triggerCaddySync)();
            }
            return reply.send({
                success: true,
                message: 'Lisensi berhasil digenerate secara manual.',
                data: license
            });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal generate lisensi: ' + err.message });
        }
    });
    // GET /api/license/list (List all licenses)
    fastify.get('/api/license/list', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const list = await helpers_1.prisma.license.findMany({
                orderBy: { createdAt: 'desc' }
            });
            const mapped = list.map(l => ({
                id: l.id,
                license_key: l.licenseKey,
                product_id: (0, helpers_1.normalizeProductId)(l.productId),
                school_name: l.schoolName,
                device_limit: l.deviceLimit,
                is_unlimited: l.isUnlimited,
                expires_at: l.expiresAt,
                status: l.status,
                is_active: l.isActive,
                plan_id: l.planId,
                requested_slug: l.requestedSlug,
                wireguard_ip: l.wireguardIp,
                include_vpn: l.includeVpn,
                created_at: l.createdAt
            }));
            return reply.send({ success: true, data: mapped });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal memuat daftar lisensi.' });
        }
    });
    // POST /api/license/approve/:id (Approve license manually)
    fastify.post('/api/license/approve/:id', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        try {
            const license = await helpers_1.prisma.license.findUnique({ where: { id } });
            if (!license) {
                return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
            }
            await helpers_1.prisma.license.update({
                where: { id },
                data: { status: 'active', isActive: 1 }
            });
            await helpers_1.prisma.subscription.updateMany({
                where: { licenseId: id },
                data: { status: 'active' }
            });
            if (license.productId !== 'privateer') {
                await (0, caddy_service_1.triggerCaddySync)();
            }
            return reply.send({
                success: true,
                message: `Lisensi untuk ${license.schoolName} berhasil disetujui!`
            });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal menyetujui lisensi.' });
        }
    });
    // DELETE /api/license/delete/:id (Delete license key)
    fastify.delete('/api/license/delete/:id', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        try {
            const license = await helpers_1.prisma.license.findUnique({ where: { id } });
            if (license) {
                await helpers_1.prisma.subscription.deleteMany({ where: { licenseId: id } });
                await helpers_1.prisma.invoice.deleteMany({ where: { licenseId: id } });
                await helpers_1.prisma.license.delete({ where: { id } });
                if (license.productId !== 'privateer') {
                    await (0, caddy_service_1.triggerCaddySync)();
                }
            }
            return reply.send({ success: true, message: 'Lisensi berhasil dibersihkan dari server secara permanen.' });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal menghapus lisensi.' });
        }
    });
    // POST /api/admin/license/reset-devices/:id (Reset device lock/HWID)
    fastify.post('/api/admin/license/reset-devices/:id', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        try {
            const license = await helpers_1.prisma.license.findUnique({ where: { id } });
            if (!license) {
                return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
            }
            await helpers_1.prisma.activatedDevice.deleteMany({
                where: { licenseId: id }
            });
            await helpers_1.prisma.license.update({
                where: { id },
                data: {
                    activeHostname: null,
                    activeOs: null,
                    originalDeviceId: null
                }
            });
            console.log(`[Admin License Reset] Reset devices/hosts lock for license: ${license.licenseKey} by admin`);
            return reply.send({ success: true, message: 'Kunci perangkat (device lock) berhasil dilepas oleh admin.' });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal melepas kunci perangkat: ' + err.message });
        }
    });
    // POST /api/admin/license/resend-wa/:id (Resend license details via WA)
    fastify.post('/api/admin/license/resend-wa/:id', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        try {
            const license = await helpers_1.prisma.license.findUnique({ where: { id } });
            if (!license) {
                return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
            }
            if (!license.operatorPhone) {
                return reply.status(400).send({ success: false, message: 'Nomor WhatsApp operator tidak terdaftar di lisensi ini.' });
            }
            const cleanWaNumber = license.operatorPhone.trim();
            const cleanSchoolName = license.schoolName.trim();
            const cleanSlug = license.requestedSlug ? license.requestedSlug.trim().toLowerCase() : '';
            const newKey = license.licenseKey;
            const dbMainDomain = await (0, settings_service_1.getSetting)('main_domain', 'absenta.id');
            const waMessage = `🟢 *[AKTIVASI LISENSI LOKAL PLATFORM CAKOLA SUCCESS]*\n\n` +
                `Yth. Operator *${cleanSchoolName}*,\n` +
                `Selamat! Proses registrasi server dan pemasangan Platform Cakola untuk sekolah Anda telah berhasil diselesaikan secara sempurna.\n\n` +
                `Berikut adalah detail lisensi dan akses Anda:\n` +
                `🔑 Kunci Lisensi: \`${newKey}\`\n` +
                `🌐 Subdomain Akses Online: *https://${cleanSlug}.${dbMainDomain}*\n` +
                `📅 Status Lisensi: *AKTIF*\n\n` +
                `*Catatan Penting*:\n` +
                `- *Akses Online (Easy-Tunnel)*: Sudah aktif secara otomatis. Aplikasi dapat langsung diakses dari internet luar melalui tautan domain di atas.\n` +
                `- *Akses Lokal (Intranet)*: Dapat diakses menggunakan IP lokal server atau pengaturan Split DNS di jaringan internal sekolah.\n` +
                `- *Langkah Selanjutnya*: Buka tautan domain sekolah Anda di atas, lalu masuk menu *Daftar Sekolah / Registrasi Sekolah* untuk membuat akun Administrator utama sekolah Anda.\n\n` +
                `Simpan pesan ini sebagai bukti catatan lisensi Anda. Terima kasih!`;
            await whatsapp_service_1.waGateway.sendMessage(cleanWaNumber, waMessage, 'MANUAL_RESEND', license.productId);
            await (0, logger_1.logLicenseActivity)(newKey, license.productId, request.ip, 'WA_RESEND_LICENSE_SUCCESS');
            return reply.send({ success: true, message: 'Data lisensi berhasil dikirim ulang ke nomor WhatsApp operator!' });
        }
        catch (err) {
            console.error('[Admin License Resend WA Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengirim ulang WhatsApp: ' + err.message });
        }
    });
};
exports.registerTenantRoutes = registerTenantRoutes;
