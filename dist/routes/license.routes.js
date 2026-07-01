"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.licenseRoutes = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const http_1 = require("../utils/http");
const invoice_template_1 = require("../utils/invoice-template");
const caddy_service_1 = require("../services/caddy.service");
const whatsapp_service_1 = require("../services/whatsapp.service");
const otp = __importStar(require("../utils/otp"));
const keys_1 = require("../utils/keys");
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
function formatWA(nomor) {
    if (!nomor)
        return '';
    let clean = nomor.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
        clean = '62' + clean.slice(1);
    }
    return clean;
}
async function verifyClient(request, reply) {
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, message: 'Harap masuk terlebih dahulu.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, keys_1.ADMIN_SECRET + '_client_session');
        if (decoded && decoded.nomor) {
            request.operator = decoded;
            return;
        }
    }
    catch (err) {
        return reply.status(401).send({ success: false, message: 'Sesi login telah berakhir. Silakan masuk kembali.' });
    }
    return reply.status(401).send({ success: false, message: 'Sesi login tidak valid.' });
}
const licenseRoutes = async (fastify) => {
    // 1. Get packages / plans list
    fastify.get('/api/license/packages', async (request, reply) => {
        const query = request.query;
        const productId = query.product_id || 'absenta';
        try {
            const plans = await prisma.plan.findMany({
                where: {
                    productId: productId,
                    isActive: true
                },
                orderBy: { id: 'asc' }
            });
            // Map plans to match Express old response
            const mappedPlans = plans.map(p => ({
                id: p.id,
                product_id: p.productId,
                title: p.name,
                price: `Rp ${p.priceMonthly.toLocaleString('id-ID')}`,
                device_limit: p.deviceLimit,
                is_unlimited: p.deviceLimit === 0 ? 1 : 0,
                name: p.name,
                features_json: JSON.stringify(p.featuresJson),
                billing_period: p.billingPeriod,
                price_monthly: p.priceMonthly,
                price_yearly: p.priceYearly,
                module_id: p.moduleId,
                service_code: p.serviceCode
            }));
            return reply.send({ success: true, data: mappedPlans });
        }
        catch (err) {
            console.error('[Get Packages Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar paket: ' + err.message });
        }
    });
    // 2. Check subdomain / slug availability
    fastify.get('/api/license/check-slug/:slug', async (request, reply) => {
        const { slug } = request.params;
        if (!slug) {
            return reply.status(400).send({ success: false, message: 'Slug tidak boleh kosong' });
        }
        try {
            const cleanSlug = slug.trim().toLowerCase();
            // Query from PostgreSQL using Prisma Client
            const existingLocal = await prisma.license.findFirst({
                where: { requestedSlug: cleanSlug },
                orderBy: { createdAt: 'desc' }
            });
            if (existingLocal) {
                const todayStr = new Date().toISOString().slice(0, 10);
                const isExpired = existingLocal.status === 'expired' || existingLocal.expiresAt < todayStr;
                const isPending = existingLocal.status === 'pending';
                if (isExpired) {
                    return reply.send({
                        success: true,
                        available: false,
                        is_recovery: true,
                        message: 'Subdomain terdaftar namun lisensi kedaluwarsa'
                    });
                }
                return reply.send({
                    success: true,
                    available: false,
                    is_recovery: false,
                    status_code: isPending ? 'pending_payment' : 'active_license',
                    message: isPending ? 'Subdomain sedang dipesan (Menunggu Pembayaran)' : 'Subdomain sudah digunakan dan masih aktif'
                });
            }
            return reply.send({ success: true, available: true, message: 'Subdomain tersedia' });
        }
        catch (err) {
            console.error('[Check Slug Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengecek ketersediaan subdomain.' });
        }
    });
    // 3. Request / renew license and billing setup
    fastify.post('/api/license/request', async (request, reply) => {
        const body = request.body;
        const { school_name, device_limit, is_unlimited, product_id, plan_id, payment_method, renew_license_key, requested_slug, include_vpn } = body;
        if (!school_name || !product_id || !plan_id) {
            return reply.status(400).send({ success: false, message: 'school_name, product_id, dan plan_id wajib diisi.' });
        }
        const prodId = product_id.trim();
        const resolvedSchoolName = school_name.trim();
        try {
            // Find the selected Plan
            const plan = await prisma.plan.findUnique({
                where: { id: plan_id }
            });
            if (!plan) {
                return reply.status(404).send({ success: false, message: 'Paket tidak ditemukan.' });
            }
            // Generate invoice number
            const randomPrefix = Math.floor(1000 + Math.random() * 9000);
            const invoiceNumber = `INV-ORK-${randomPrefix}-${new Date().getFullYear()}`;
            // Set expiry and limits
            const isUnlimited = is_unlimited || (plan.deviceLimit === 0 ? 1 : 0);
            const limit = device_limit || plan.deviceLimit;
            const placeholderExpire = new Date();
            placeholderExpire.setFullYear(placeholderExpire.getFullYear() + 1);
            const expiresStr = placeholderExpire.toISOString().slice(0, 10);
            // Verify License renewal or key generation
            let existingLicense = null;
            if (renew_license_key) {
                existingLicense = await prisma.license.findUnique({
                    where: { licenseKey: renew_license_key.trim() }
                });
            }
            const generateKey = (_prod, prefix) => {
                const rand = crypto_1.default.randomBytes(8).toString('hex').toUpperCase();
                return `${prefix}-${rand.slice(0, 4)}-${rand.slice(4, 8)}-${rand.slice(8, 12)}`;
            };
            const productPrefix = prodId === 'absenta' ? 'ABS' : (prodId === 'gform-orkestrator' ? 'GF' : 'YT');
            const newKey = existingLicense ? existingLicense.licenseKey : generateKey(prodId, productPrefix);
            const resolvedSlug = requested_slug ? requested_slug.trim().toLowerCase() : null;
            if (resolvedSlug && !existingLicense) {
                // Validate slug uniqueness locally
                const existingSlug = await prisma.license.findFirst({
                    where: { requestedSlug: resolvedSlug, productId: prodId }
                });
                if (existingSlug) {
                    return reply.status(400).send({
                        success: false,
                        message: `Subdomain / Slug '${resolvedSlug}' sudah digunakan oleh ${existingSlug.schoolName}. Silakan gunakan subdomain yang berbeda.`
                    });
                }
            }
            let basePrice = plan.priceMonthly;
            if (plan.billingPeriod === 'YEAR') {
                basePrice = plan.priceYearly;
            }
            // ──────── 1. GRATIS / HARGA 0 ────────
            if (basePrice === 0) {
                let licenseId = '';
                if (existingLicense) {
                    licenseId = existingLicense.id;
                }
                else {
                    const lic = await prisma.license.create({
                        data: {
                            licenseKey: newKey,
                            productId: prodId,
                            schoolName: resolvedSchoolName,
                            deviceLimit: limit,
                            isUnlimited: isUnlimited,
                            expiresAt: expiresStr,
                            status: 'pending',
                            isActive: 0,
                            planId: plan.id,
                            requestedSlug: resolvedSlug,
                            includeVpn: include_vpn || 0
                        }
                    });
                    licenseId = lic.id;
                    await prisma.subscription.create({
                        data: {
                            licenseId,
                            schoolName: resolvedSchoolName,
                            productId: prodId,
                            planId: plan.id,
                            status: 'pending',
                            startDate: '',
                            endDate: ''
                        }
                    });
                }
                await prisma.invoice.create({
                    data: {
                        invoiceNumber,
                        licenseId,
                        schoolName: resolvedSchoolName,
                        productId: prodId,
                        planTitle: plan.name,
                        amount: 0,
                        status: 'paid',
                        paymentMethod: 'Gateway',
                        paymentInstructions: [],
                        expiredTime: String(Math.floor(Date.now() / 1000) + 48 * 3600),
                        paidAt: new Date(),
                        planId: plan.id
                    }
                });
                return reply.send({
                    success: true,
                    message: 'Pengajuan lisensi gratis berhasil diaktifkan.',
                    data: {
                        license_key: newKey,
                        invoice_number: invoiceNumber,
                        amount: 0,
                        payment_method: 'Gateway',
                        status: 'paid',
                        expired_time: Math.floor(Date.now() / 1000) + 48 * 3600
                    }
                });
            }
            // ──────── 2. MANUAL TRANSFER ────────
            const resolvedPaymentMethod = payment_method || 'QRIS2';
            if (resolvedPaymentMethod === 'Manual' || resolvedPaymentMethod === 'manual') {
                let licenseId = '';
                if (existingLicense) {
                    licenseId = existingLicense.id;
                }
                else {
                    const lic = await prisma.license.create({
                        data: {
                            licenseKey: newKey,
                            productId: prodId,
                            schoolName: resolvedSchoolName,
                            deviceLimit: limit,
                            isUnlimited: isUnlimited,
                            expiresAt: expiresStr,
                            status: 'pending',
                            isActive: 0,
                            planId: plan.id,
                            requestedSlug: resolvedSlug,
                            includeVpn: include_vpn || 0
                        }
                    });
                    licenseId = lic.id;
                    await prisma.subscription.create({
                        data: {
                            licenseId,
                            schoolName: resolvedSchoolName,
                            productId: prodId,
                            planId: plan.id,
                            status: 'pending',
                            startDate: '',
                            endDate: ''
                        }
                    });
                }
                const instructions = [
                    { title: 'Langkah 1: Transfer Bank', steps: ['Transfer ke Rekening BNI: 1234567890 a/n Baraya Teknologi', `Sebesar Rp ${basePrice.toLocaleString('id-ID')}`] },
                    { title: 'Langkah 2: Konfirmasi', steps: ['Kirim bukti transfer ke WhatsApp admin kami.'] }
                ];
                await prisma.invoice.create({
                    data: {
                        invoiceNumber,
                        licenseId,
                        schoolName: resolvedSchoolName,
                        productId: prodId,
                        planTitle: plan.name,
                        amount: basePrice,
                        status: 'unpaid',
                        paymentMethod: 'Manual',
                        paymentInstructions: instructions,
                        expiredTime: String(Math.floor(Date.now() / 1000) + 48 * 3600),
                        planId: plan.id
                    }
                });
                return reply.send({
                    success: true,
                    message: 'Pengajuan lisensi manual berhasil diproses.',
                    data: {
                        license_key: newKey,
                        invoice_number: invoiceNumber,
                        amount: basePrice,
                        payment_method: 'Manual',
                        payment_instructions: instructions,
                        expired_time: Math.floor(Date.now() / 1000) + 48 * 3600
                    }
                });
            }
            // ──────── 3. TRIPAY GATEWAY ────────
            const TRIPAY_API_KEY = process.env.TRIPAY_API_KEY || '';
            const TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY || '';
            const TRIPAY_MERCHANT_CODE = process.env.TRIPAY_MERCHANT_CODE || '';
            const TRIPAY_API_URL = process.env.TRIPAY_API_URL || 'https://tripay.co.id/api-sandbox';
            // Signature Tripay
            const signature = crypto_1.default
                .createHmac('sha256', TRIPAY_PRIVATE_KEY)
                .update(TRIPAY_MERCHANT_CODE + invoiceNumber + basePrice)
                .digest('hex');
            const tripayPayload = {
                method: resolvedPaymentMethod,
                merchant_ref: invoiceNumber,
                amount: basePrice,
                customer_name: resolvedSchoolName,
                customer_email: 'billing@absenta.id',
                customer_phone: '087779937341',
                order_items: [
                    {
                        sku: plan.id,
                        name: `${prodId.toUpperCase()} - ${plan.name}`,
                        price: basePrice,
                        quantity: 1
                    }
                ],
                expired_time: Math.floor(Date.now() / 1000) + 24 * 3600,
                signature
            };
            let tripayResponseData = null;
            try {
                const fetch = require('node-fetch');
                const response = await fetch(`${TRIPAY_API_URL}/transaction/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${TRIPAY_API_KEY}`
                    },
                    body: JSON.stringify(tripayPayload),
                    timeout: 4000
                });
                tripayResponseData = await response.json();
            }
            catch (err) {
                console.error('[Tripay API Net Error]', err.message);
            }
            if (tripayResponseData && tripayResponseData.success && tripayResponseData.data) {
                const tx = tripayResponseData.data;
                let licenseId = '';
                if (existingLicense) {
                    licenseId = existingLicense.id;
                }
                else {
                    const lic = await prisma.license.create({
                        data: {
                            licenseKey: newKey,
                            productId: prodId,
                            schoolName: resolvedSchoolName,
                            deviceLimit: limit,
                            isUnlimited: isUnlimited,
                            expiresAt: expiresStr,
                            status: 'pending',
                            isActive: 0,
                            planId: plan.id,
                            requestedSlug: resolvedSlug,
                            includeVpn: include_vpn || 0
                        }
                    });
                    licenseId = lic.id;
                    await prisma.subscription.create({
                        data: {
                            licenseId,
                            schoolName: resolvedSchoolName,
                            productId: prodId,
                            planId: plan.id,
                            status: 'pending',
                            startDate: '',
                            endDate: ''
                        }
                    });
                }
                await prisma.invoice.create({
                    data: {
                        invoiceNumber,
                        licenseId,
                        schoolName: resolvedSchoolName,
                        productId: prodId,
                        planTitle: plan.name,
                        amount: tx.amount || basePrice,
                        status: 'unpaid',
                        paymentMethod: resolvedPaymentMethod,
                        paymentInstructions: tx.instructions || [],
                        expiredTime: String(tx.expired_time),
                        planId: plan.id
                    }
                });
                return reply.send({
                    success: true,
                    message: 'Invoice Tripay berhasil dibuat.',
                    data: {
                        license_key: newKey,
                        invoice_number: invoiceNumber,
                        amount: tx.amount || basePrice,
                        payment_method: resolvedPaymentMethod,
                        payment_reference: tx.reference,
                        qr_url: tx.qr_url || null,
                        pay_code: tx.pay_code || null,
                        payment_instructions: tx.instructions || [],
                        expired_time: tx.expired_time
                    }
                });
            }
            else {
                const errorMsg = tripayResponseData?.message || 'Gateway pembayaran Tripay sedang offline.';
                return reply.status(400).send({ success: false, message: errorMsg });
            }
        }
        catch (err) {
            console.error('[Request Billing Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal memproses request billing: ' + err.message });
        }
    });
    // 4. Tripay callback webhook receiver
    fastify.post('/api/license/tripay-callback', async (request, reply) => {
        const callbackSignature = request.headers['x-callback-signature'];
        const TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY || '';
        if (!callbackSignature) {
            return reply.status(400).send({ success: false, message: 'Missing callback signature.' });
        }
        const rawPayload = JSON.stringify(request.body);
        const calculatedSignature = crypto_1.default
            .createHmac('sha256', TRIPAY_PRIVATE_KEY)
            .update(rawPayload)
            .digest('hex');
        if (callbackSignature !== calculatedSignature) {
            return reply.status(403).send({ success: false, message: 'Invalid callback signature.' });
        }
        const body = request.body;
        const { merchant_ref, status } = body;
        if (status === 'PAID') {
            try {
                const invoice = await prisma.invoice.findUnique({
                    where: { invoiceNumber: merchant_ref }
                });
                if (!invoice) {
                    return reply.status(404).send({ success: false, message: 'Invoice not found.' });
                }
                if (invoice.status === 'paid') {
                    return reply.send({ success: true, message: 'Already paid.' });
                }
                // Update invoice
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { status: 'paid', paidAt: new Date() }
                });
                // Resolve license duration
                const planId = invoice.planId || '';
                let days = 30;
                if (planId.includes('semester'))
                    days = 180;
                else if (planId.includes('annual'))
                    days = 365;
                else if (planId.includes('lifetime'))
                    days = 3650;
                const baseDate = new Date();
                baseDate.setDate(baseDate.getDate() + days);
                const expiresStr = baseDate.toISOString().slice(0, 10);
                // Activate license
                const lic = await prisma.license.update({
                    where: { id: invoice.licenseId },
                    data: { status: 'active', isActive: 1, expiresAt: expiresStr }
                });
                // Upsert subscription
                const existingSub = await prisma.subscription.findFirst({
                    where: { licenseId: lic.id, planId }
                });
                if (existingSub) {
                    await prisma.subscription.update({
                        where: { id: existingSub.id },
                        data: { status: 'active', startDate: new Date().toISOString().slice(0, 10), endDate: expiresStr }
                    });
                }
                else {
                    await prisma.subscription.create({
                        data: {
                            licenseId: lic.id,
                            schoolName: lic.schoolName,
                            productId: lic.productId,
                            planId,
                            status: 'active',
                            startDate: new Date().toISOString().slice(0, 10),
                            endDate: expiresStr
                        }
                    });
                }
                // Realtime webhook push to school client
                if (lic.requestedSlug) {
                    const schoolDomain = `https://${lic.requestedSlug}.absenta.id`;
                    const callbackUrl = `${schoolDomain}/api/billing/subscriptions/license/callback`;
                    (0, http_1.httpPost)(callbackUrl, { license_key: lic.licenseKey, tenant_id: lic.requestedSlug }, {}, 6000)
                        .then(res => console.log('[Tripay Callback Push Success]', res.status))
                        .catch(err => console.log('[Tripay Callback Push Offline/NAT]', err.message));
                }
                // Trigger dynamic routing sync
                await (0, caddy_service_1.triggerCaddySync)();
            }
            catch (err) {
                console.error('[Tripay Callback Database Error]', err.message);
                return reply.status(500).send({ success: false, message: 'Database sync error.' });
            }
        }
        return reply.send({ success: true });
    });
    // 5. Get school licenses & invoices history by core license key (Stateless Pull Sync API)
    fastify.get('/api/license/history-by-core-key/:coreKey', async (request, reply) => {
        const { coreKey } = request.params;
        try {
            const coreLicense = await prisma.license.findUnique({
                where: { licenseKey: coreKey.trim() },
                select: { requestedSlug: true }
            });
            if (!coreLicense || !coreLicense.requestedSlug) {
                return reply.status(404).send({ success: false, message: 'Lisensi core tidak terdaftar.' });
            }
            const slugLower = coreLicense.requestedSlug.toLowerCase();
            // Find all licenses under this subdomain slug
            const licenses = await prisma.license.findMany({
                where: { requestedSlug: slugLower },
                orderBy: { id: 'desc' }
            });
            // Find all invoices under these license IDs
            const licenseIds = licenses.map(l => l.id);
            let invoices = [];
            if (licenseIds.length > 0) {
                invoices = await prisma.invoice.findMany({
                    where: { licenseId: { in: licenseIds } },
                    orderBy: { createdAt: 'desc' }
                });
            }
            // Map response to match Express naming format (using flat mappings)
            const mappedLicenses = licenses.map(l => ({
                id: l.id,
                product_id: l.productId,
                license_key: l.licenseKey,
                school_name: l.schoolName,
                status: l.status,
                is_active: l.isActive,
                requested_slug: l.requestedSlug,
                wireguard_ip: l.wireguardIp,
                expires_at: l.expiresAt
            }));
            const mappedInvoices = invoices.map(i => ({
                id: i.id,
                invoice_number: i.invoiceNumber,
                license_id: i.licenseId,
                school_name: i.schoolName,
                product_id: i.productId,
                plan_title: i.planTitle,
                amount: i.amount,
                status: i.status,
                payment_method: i.paymentMethod,
                payment_instructions: JSON.stringify(i.paymentInstructions),
                expired_time: i.expiredTime,
                paid_at: i.paidAt ? i.paidAt.toISOString() : null,
                plan_id: i.planId
            }));
            return reply.send({
                success: true,
                data: {
                    licenses: mappedLicenses,
                    invoices: mappedInvoices
                }
            });
        }
        catch (err) {
            console.error('[History by Core Key Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal memuat riwayat transaksi: ' + err.message });
        }
    });
    // 6. Renders clean, premium invoice receipt HTML printable page
    fastify.get('/api/license/print-invoice/:invoiceNumber', async (request, reply) => {
        const { invoiceNumber } = request.params;
        try {
            const inv = await prisma.invoice.findUnique({
                where: { invoiceNumber: invoiceNumber.trim() },
                include: {
                    license: { include: { plan: true } },
                    plan: true
                }
            });
            if (!inv) {
                return reply.status(404).type('text/html').send('<h1>Error 404: Invoice tidak ditemukan</h1>');
            }
            const planTitle = inv.planTitle;
            const planPrice = `Rp ${inv.amount.toLocaleString('id-ID')}`;
            const planDuration = planTitle.toLowerCase().includes('bulan') ? '30 Hari' : (planTitle.toLowerCase().includes('sem') ? '180 Hari' : '365 Hari');
            const dateStr = inv.paidAt
                ? (0, invoice_template_1.formatIndonesianDate)(inv.paidAt.toISOString().slice(0, 10))
                : (0, invoice_template_1.formatIndonesianDate)(inv.createdAt.toISOString().slice(0, 10));
            const product = await prisma.product.findUnique({ where: { id: inv.productId } });
            const productName = product ? product.name : 'Aplikasi Premium';
            const productDesc = 'Sistem terintegrasi dan berkinerja tinggi skala SaaS Enterprise.';
            // Kapasitas Dinamis: sumber utama dari plan yang terikat di lisensi (license.planId → Plan.deviceLimit)
            // Fallback: invoice.plan → license.deviceLimit
            const isAbsenta = inv.productId === 'absenta' || inv.productId === 'platform-absenta';
            const licPlan = inv.license.plan;
            const rawLimit = licPlan?.deviceLimit ?? inv.plan?.deviceLimit ?? inv.license.deviceLimit;
            const isUnlimited = rawLimit === 0 || rawLimit === 9999;
            let capacityStr = 'Standar';
            if (isAbsenta) {
                capacityStr = isUnlimited ? 'Unlimited Pengguna' : `Maks. ${rawLimit} Pengguna`;
            }
            else {
                capacityStr = isUnlimited ? 'Unlimited HP/Akses' : `Maks. ${rawLimit} HP/Akses`;
            }
            const verifyHash = Buffer.from(`${inv.invoiceNumber}:${inv.id}:${inv.amount}`).toString('base64').slice(0, 16).toUpperCase();
            const nowUnix = Math.floor(Date.now() / 1000);
            const isExpired = inv.status !== 'paid' && inv.status !== 'cancelled' && Number(inv.expiredTime || 0) > 0 && nowUnix > Number(inv.expiredTime);
            const statusLabel = inv.status === 'paid'
                ? 'LUNAS'
                : (isExpired ? 'KEDALUWARSA' : 'BELUM BAYAR');
            let cleanSchoolName = inv.schoolName;
            if (!cleanSchoolName || cleanSchoolName === '0') {
                cleanSchoolName = inv.license?.schoolName && inv.license?.schoolName !== '0'
                    ? inv.license.schoolName
                    : (inv.license?.requestedSlug ? `${inv.license.requestedSlug.toUpperCase()} (Absenta)` : 'Instansi Sekolah');
            }
            const invoiceHtml = (0, invoice_template_1.renderInvoiceTemplate)({
                invoiceNumber: inv.invoiceNumber,
                cleanSchoolName,
                dateStr,
                statusLabel,
                isPaid: inv.status === 'paid',
                isExpired,
                payMethodLabel: inv.paymentMethod,
                licenseKey: inv.license.licenseKey,
                productName,
                planTitle,
                productDesc,
                planDuration,
                capacityStr,
                planPrice,
                verifyHash
            });
            return reply.type('text/html').send(invoiceHtml);
        }
        catch (err) {
            console.error('[Print Invoice Error]', err.message);
            return reply.status(500).type('text/html').send('<h1>Error 500: Gagal merender invoice</h1>');
        }
    });
    // 7. Wireguard Client Tunnel Request
    fastify.post('/api/license/tunnel/request', async (request, reply) => {
        const body = request.body;
        const { license_key, subdomain_slug, local_port, frontend_port } = body;
        if (!license_key || !subdomain_slug) {
            return reply.status(400).send({ success: false, message: 'License key dan subdomain slug wajib diisi.' });
        }
        try {
            const slugLower = subdomain_slug.trim().toLowerCase();
            if (!/^[a-z0-9-]+$/.test(slugLower)) {
                return reply.status(400).send({ success: false, message: 'Subdomain slug hanya boleh huruf kecil, angka, dan strip (-).' });
            }
            // Verify active license for vpn-tunnel
            const license = await prisma.license.findFirst({
                where: {
                    licenseKey: license_key.trim(),
                    isActive: 1,
                    productId: 'vpn-tunnel'
                }
            });
            if (!license) {
                return reply.status(403).send({ success: false, message: 'Lisensi VPN Tunneling tidak ditemukan atau tidak aktif.' });
            }
            // Check if subdomain slug is already used
            const existingSlug = await prisma.license.findFirst({
                where: {
                    requestedSlug: slugLower,
                    id: { not: license.id },
                    productId: license.productId
                }
            });
            if (existingSlug) {
                return reply.status(400).send({ success: false, message: 'Subdomain tersebut sudah digunakan oleh instansi lain.' });
            }
            let clientIp = license.wireguardIp;
            if (!clientIp) {
                // Find next IP in range (start from 10.0.0.10)
                const activeLicenses = await prisma.license.findMany({
                    where: { wireguardIp: { not: null } },
                    select: { wireguardIp: true }
                });
                let maxOctet = 9;
                activeLicenses.forEach(l => {
                    const parts = l.wireguardIp.split('.');
                    if (parts.length === 4) {
                        const octet = parseInt(parts[3], 10);
                        if (!isNaN(octet) && octet > maxOctet) {
                            maxOctet = octet;
                        }
                    }
                });
                clientIp = `10.0.0.${maxOctet + 1}`;
            }
            // Execute Wireguard generation commands securely
            const { execSync } = require('child_process');
            const privateKey = execSync('wg genkey').toString().trim();
            const publicKey = execSync(`echo "${privateKey}" | wg pubkey`).toString().trim();
            const localPort = local_port || 5002;
            const frontendPort = frontend_port || 5174;
            const safeSchoolName = license.schoolName.replace(/[^a-zA-Z0-9 ]/g, '');
            const execCmd = `sudo /usr/local/bin/add-wg-peer.sh "${safeSchoolName}" "${publicKey}" "${clientIp}" "${slugLower}" "${localPort}" "${frontendPort}"`;
            console.log(`[VPN Tunnel] Executing command: ${execCmd}`);
            try {
                execSync(execCmd);
            }
            catch (errCmd) {
                console.error('[VPN Tunnel Cmd Error]', errCmd.message);
            }
            // Update license in database
            await prisma.license.update({
                where: { id: license.id },
                data: {
                    wireguardIp: clientIp,
                    requestedSlug: slugLower
                }
            });
            // Synchronize Caddy file
            await (0, caddy_service_1.triggerCaddySync)();
            // Generate client WireGuard config
            let serverPublicKey = 'SP47bTGqXxN4Qqe2DewpONtYEOh2qcXPTj7dt1g1x2o=';
            try {
                const fs = require('fs');
                if (fs.existsSync('/etc/wireguard/publickey')) {
                    serverPublicKey = fs.readFileSync('/etc/wireguard/publickey', 'utf8').trim();
                }
            }
            catch (e) { }
            const mainDomain = process.env.MAIN_DOMAIN || 'absenta.id';
            const serverEndpoint = process.env.VPS_IP || `api.${mainDomain}`;
            const clientConfig = `[Interface]
PrivateKey = ${privateKey}
Address = ${clientIp}/24
DNS = 1.1.1.1

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${serverEndpoint}:51820
AllowedIPs = 10.0.0.0/24
PersistentKeepalive = 25
`;
            return reply.send({
                success: true,
                message: 'Koneksi Wireguard Tunnel berhasil disiapkan.',
                data: {
                    license_key: license_key,
                    client_ip: clientIp,
                    subdomain: `${slugLower}.${mainDomain}`,
                    config: clientConfig
                }
            });
        }
        catch (err) {
            console.error('[Wireguard Request Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal memproses request tunnel: ' + err.message });
        }
    });
    // 8. Easy Tunnel: Get packages
    fastify.get('/api/license/easy-tunnel/packages', async (_request, reply) => {
        try {
            const plans = await prisma.plan.findMany({
                where: { productId: 'easy-tunnel', isActive: true },
                orderBy: { id: 'asc' }
            });
            return reply.send({ success: true, data: plans });
        }
        catch (err) {
            console.error('[Easy Tunnel Packages Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengambil paket Easy Tunnel.' });
        }
    });
    // 9. Easy Tunnel: Validate license key
    fastify.get('/api/license/easy-tunnel/validate/:key', async (request, reply) => {
        const { key } = request.params;
        try {
            const license = await prisma.license.findUnique({
                where: { licenseKey: key.trim() }
            });
            if (!license || license.productId !== 'easy-tunnel') {
                return reply.status(404).send({ success: false, message: 'Kunci lisensi Easy Tunnel tidak ditemukan.' });
            }
            const todayStr = new Date().toISOString().slice(0, 10);
            const expired = license.isActive === 0 || license.status === 'expired' || license.expiresAt < todayStr;
            return reply.send({
                success: true,
                data: {
                    license_key: license.licenseKey,
                    school_name: license.schoolName,
                    expires_at: license.expiresAt,
                    wireguard_ip: license.wireguardIp || null,
                    requested_slug: license.requestedSlug || null,
                    local_port: license.localPort || null,
                    app_name: license.appName || null,
                    active_hostname: license.activeHostname || null,
                    expired: expired
                }
            });
        }
        catch (err) {
            console.error('[Easy Tunnel Validate Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal memvalidasi lisensi Easy Tunnel.' });
        }
    });
    // 10. Easy Tunnel: Request tunnel configuration
    fastify.post('/api/license/easy-tunnel/request', async (request, reply) => {
        const body = request.body;
        const { license_key, subdomain_slug, local_port, app_name, hostname } = body;
        if (!license_key || !subdomain_slug || !local_port) {
            return reply.status(400).send({
                success: false,
                message: 'license_key, subdomain_slug, dan local_port wajib diisi.'
            });
        }
        try {
            const slugLower = subdomain_slug.trim().toLowerCase();
            if (!/^[a-z0-9-]+$/.test(slugLower)) {
                return reply.status(400).send({
                    success: false,
                    message: 'Subdomain slug hanya boleh huruf kecil, angka, dan strip (-).'
                });
            }
            const portNum = parseInt(local_port, 10);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                return reply.status(400).send({ success: false, message: 'Port lokal tidak valid (1-65535).' });
            }
            // 1. Verifikasi lisensi aktif easy-tunnel
            const license = await prisma.license.findFirst({
                where: {
                    licenseKey: license_key.trim(),
                    isActive: 1,
                    productId: 'easy-tunnel'
                }
            });
            if (!license) {
                return reply.status(403).send({
                    success: false,
                    message: 'Lisensi Easy Tunnel tidak ditemukan atau tidak aktif.'
                });
            }
            const todayStr = new Date().toISOString().slice(0, 10);
            if (license.expiresAt < todayStr) {
                return reply.status(403).send({ success: false, message: 'Lisensi Easy Tunnel telah kedaluwarsa.' });
            }
            // Single Device Lock by Hostname
            if (hostname) {
                const reqHostname = hostname.trim();
                if (license.activeHostname && license.activeHostname !== reqHostname) {
                    return reply.status(403).send({
                        success: false,
                        message: `Lisensi ini sudah aktif di komputer '${license.activeHostname}'. Silakan hapus/uninstal terowongan terlebih dahulu di komputer tersebut sebelum memasang di komputer baru.`
                    });
                }
            }
            // 2. Cek slug tidak duplikat
            const existingSlug = await prisma.license.findFirst({
                where: {
                    requestedSlug: slugLower,
                    id: { not: license.id }
                }
            });
            if (existingSlug) {
                return reply.status(400).send({
                    success: false,
                    message: `Subdomain '${slugLower}' sudah digunakan oleh instansi lain. Silakan pilih subdomain yang berbeda.`
                });
            }
            // 3. Assign IP
            let clientIp = license.wireguardIp;
            if (!clientIp) {
                const activeLicenses = await prisma.license.findMany({
                    where: { wireguardIp: { not: null } },
                    select: { wireguardIp: true }
                });
                let maxOctet = 9;
                activeLicenses.forEach(l => {
                    const parts = l.wireguardIp.split('.');
                    if (parts.length === 4) {
                        const octet = parseInt(parts[3], 10);
                        if (!isNaN(octet) && octet > maxOctet)
                            maxOctet = octet;
                    }
                });
                clientIp = `10.0.0.${maxOctet + 1}`;
            }
            // 4. Generate WireGuard keypair
            const { execSync } = require('child_process');
            const privateKey = execSync('wg genkey').toString().trim();
            const publicKey = execSync(`echo "${privateKey}" | wg pubkey`).toString().trim();
            // 5. Hot-add peer
            const safeSchoolName = (license.schoolName || '').replace(/[^a-zA-Z0-9 ]/g, '');
            const safeAppName = (app_name || 'EasyTunnel').replace(/[^a-zA-Z0-9 ]/g, '');
            // Clean up old peer
            try {
                const removeCmd = `sudo python3 /var/www/licensing-server/scripts/remove-wg-peer.py "${clientIp}" "${publicKey}"`;
                console.log(`[Easy Tunnel] Cleaning up old peers: ${removeCmd}`);
                execSync(removeCmd);
            }
            catch (cleanupErr) {
                console.warn('[Easy Tunnel WARNING] Failed to clean up old peers:', cleanupErr.message);
            }
            const execCmd = `sudo /usr/local/bin/add-wg-peer.sh "${safeSchoolName} - ${safeAppName}" "${publicKey}" "${clientIp}" "${slugLower}" "${portNum}" "${portNum}"`;
            console.log(`[Easy Tunnel] Running system command: ${execCmd}`);
            execSync(execCmd);
            // Firewall rule check
            try {
                execSync('sudo iptables -C FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable', { stdio: 'ignore' });
            }
            catch (checkErr) {
                try {
                    execSync('sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --src-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable && ' +
                        'sudo iptables -A FORWARD -i wg0 -o wg0 -m iprange --dst-range 10.0.0.10-10.0.0.254 -j REJECT --reject-with icmp-port-unreachable');
                    execSync("if [ -d /etc/iptables ]; then sudo sh -c 'iptables-save > /etc/iptables/rules.v4'; fi", { stdio: 'ignore' });
                }
                catch (applyErr) {
                    console.warn('[Easy Tunnel WARNING] Failed to apply iptables rules:', applyErr.message);
                }
            }
            // 6. Save to DB
            await prisma.license.update({
                where: { id: license.id },
                data: {
                    wireguardIp: clientIp,
                    requestedSlug: slugLower,
                    localPort: portNum,
                    appName: app_name || null,
                    activeHostname: hostname ? hostname.trim() : null
                }
            });
            await (0, caddy_service_1.triggerCaddySync)();
            // 7. Generate client WireGuard config
            let serverPublicKey = 'SP47bTGqXxN4Qqe2DewpONtYEOh2qcXPTj7dt1g1x2o=';
            try {
                const fs = require('fs');
                if (fs.existsSync('/etc/wireguard/publickey')) {
                    serverPublicKey = fs.readFileSync('/etc/wireguard/publickey', 'utf8').trim();
                }
            }
            catch (e) { }
            const mainDomain = process.env.MAIN_DOMAIN || 'absenta.id';
            const serverEndpoint = process.env.VPS_IP || `api.${mainDomain}`;
            const clientConfig = `[Interface]
PrivateKey = ${privateKey}
Address = ${clientIp}/24
DNS = 1.1.1.1

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${serverEndpoint}:51820
AllowedIPs = 10.0.0.0/24
PersistentKeepalive = 25
`;
            return reply.send({
                success: true,
                message: 'Easy Tunnel WireGuard berhasil dibuat.',
                data: {
                    license_key,
                    client_ip: clientIp,
                    subdomain: `${slugLower}.${mainDomain}`,
                    local_port: portNum,
                    app_name: app_name || null,
                    config: clientConfig
                }
            });
        }
        catch (err) {
            console.error('[Easy Tunnel Request Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal memproses request tunnel: ' + err.message });
        }
    });
    // 11. Easy Tunnel: Check VNC port reachability
    fastify.get('/api/license/easy-tunnel/check-vnc-port/:license_key', async (request, reply) => {
        const { license_key } = request.params;
        if (!license_key) {
            return reply.status(400).send({ success: false, message: 'License key wajib diisi.' });
        }
        const cleanKey = license_key.trim();
        try {
            const license = await prisma.license.findUnique({
                where: { licenseKey: cleanKey }
            });
            if (!license || license.productId !== 'easy-tunnel') {
                return reply.status(404).send({ success: false, message: 'Kunci lisensi tidak ditemukan.' });
            }
            if (license.isActive !== 1) {
                return reply.status(400).send({ success: false, message: 'Lisensi tidak aktif.' });
            }
            if (!license.wireguardIp) {
                return reply.status(400).send({ success: false, message: 'Tunnel WireGuard belum diaktifkan (IP WireGuard kosong).' });
            }
            const net = require('net');
            const checkTcpPort = (ip, port, timeoutMs = 2500) => {
                return new Promise((resolve) => {
                    const socket = new net.Socket();
                    let resolved = false;
                    socket.setTimeout(timeoutMs);
                    socket.connect(port, ip, () => {
                        if (!resolved) {
                            resolved = true;
                            socket.destroy();
                            resolve(true);
                        }
                    });
                    socket.on('error', () => {
                        if (!resolved) {
                            resolved = true;
                            socket.destroy();
                            resolve(false);
                        }
                    });
                    socket.on('timeout', () => {
                        if (!resolved) {
                            resolved = true;
                            socket.destroy();
                            resolve(false);
                        }
                    });
                });
            };
            const isReachable = await checkTcpPort(license.wireguardIp, 5900, 2500);
            return reply.send({
                success: true,
                wireguard_ip: license.wireguardIp,
                reachable: isReachable
            });
        }
        catch (err) {
            console.error('[Check VNC Port Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal memeriksa port VNC: ' + err.message });
        }
    });
    // 12. Client Auth: Request OTP
    fastify.post('/api/auth/request-otp', async (request, reply) => {
        const { nomor } = request.body;
        if (!nomor) {
            return reply.status(400).send({ success: false, message: 'Nomor WhatsApp wajib diisi.' });
        }
        const formatted = formatWA(nomor);
        if (!formatted.startsWith('62') || formatted.length < 10) {
            return reply.status(400).send({ success: false, message: 'Format nomor WhatsApp tidak valid.' });
        }
        if (otp.hasActiveOTP(formatted)) {
            const remaining = otp.getRemainingSeconds(formatted);
            return reply.status(429).send({
                success: false,
                message: `Silakan tunggu ${remaining} detik sebelum meminta kode OTP kembali.`
            });
        }
        try {
            const code = otp.generateOTP(formatted);
            const templates = [
                `*[Easy Tunnel]*\n\nKode OTP verifikasi Anda adalah: *${code}*\n\nJangan bagikan kode ini kepada siapa pun. Kode berlaku selama 5 menit.`,
                `🔑 *Kode OTP Easy Tunnel*: *${code}*\n\nMasukkan kode ini untuk masuk ke dashboard. Rahasiakan kode verifikasi Anda. Kedaluwarsa dalam 5 menit.`,
                `Halo! Berikut adalah kode verifikasi akun Easy Tunnel Anda:\n\n*${code}*\n\nBerlaku selama 5 menit. Abaikan jika Anda tidak memintanya.`,
                `⚠️ *KEAMANAN AKUN - Easy Tunnel*\n\nKode verifikasi masuk Anda: *${code}*\n\nKode ini bersifat rahasia dan aktif selama 300 detik.`,
                `Berikut adalah kode OTP Anda untuk masuk ke sistem:\n🔑 *${code}*\n\nBerlaku 5 menit. Tim kami tidak pernah meminta kode ini.`,
                `Kode verifikasi Easy Tunnel Anda: *${code}*`,
                `OTP masuk Easy Tunnel: *${code}*`,
                `Kode OTP Anda: *${code}* (Berlaku 5 menit)`,
                `Gunakan kode *${code}* untuk login ke dashboard Easy Tunnel.`
            ];
            const randTemplate = templates[Math.floor(Math.random() * templates.length)];
            const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
            const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
            const message = `${randTemplate}\n\n_[Ref: ${randomChars} - Pukul ${timeStr}]_`;
            await whatsapp_service_1.waGateway.sendMessage(formatted, message);
            return reply.send({ success: true, message: 'Kode OTP berhasil dikirim ke nomor WhatsApp Anda.' });
        }
        catch (err) {
            console.error('[Request OTP Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengirim OTP: ' + err.message });
        }
    });
    // 13. Client Auth: Verify OTP
    fastify.post('/api/auth/verify-otp', async (request, reply) => {
        const { nomor, code } = request.body;
        if (!nomor || !code) {
            return reply.status(400).send({ success: false, message: 'Nomor WhatsApp dan kode OTP wajib diisi.' });
        }
        const formatted = formatWA(nomor);
        const result = otp.verifyOTP(formatted, code);
        if (!result.valid) {
            return reply.status(400).send({ success: false, message: result.reason });
        }
        const token = jsonwebtoken_1.default.sign({ nomor: formatted }, keys_1.ADMIN_SECRET + '_client_session', { expiresIn: '30d' });
        return reply.send({
            success: true,
            token,
            message: 'Verifikasi berhasil!'
        });
    });
    // 14. Client Auth: Get my licenses
    fastify.get('/api/auth/my-licenses', async (request, reply) => {
        await verifyClient(request, reply);
        if (reply.sent)
            return;
        const { nomor } = request.operator;
        try {
            const list = await prisma.license.findMany({
                where: { operatorPhone: nomor, productId: 'easy-tunnel' },
                orderBy: { createdAt: 'desc' }
            });
            const mapped = list.map(l => ({
                id: l.id,
                license_key: l.licenseKey,
                product_id: l.productId,
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
                local_port: l.localPort,
                app_name: l.appName,
                active_hostname: l.activeHostname,
                created_at: l.createdAt
            }));
            return reply.send({ success: true, count: mapped.length, data: mapped });
        }
        catch (err) {
            console.error('[Get Licenses Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar lisensi: ' + err.message });
        }
    });
    // 15. Client Auth: Claim license
    fastify.post('/api/auth/claim-license', async (request, reply) => {
        await verifyClient(request, reply);
        if (reply.sent)
            return;
        const { nomor } = request.operator;
        const { license_key } = request.body;
        if (!license_key) {
            return reply.status(400).send({ success: false, message: 'License key wajib diisi.' });
        }
        const cleanKey = license_key.trim();
        try {
            const license = await prisma.license.findUnique({
                where: { licenseKey: cleanKey }
            });
            if (!license || license.productId !== 'easy-tunnel') {
                return reply.status(404).send({ success: false, message: 'Kunci lisensi tidak ditemukan.' });
            }
            if (license.operatorPhone && license.operatorPhone !== nomor) {
                return reply.status(400).send({
                    success: false,
                    message: 'Kunci lisensi ini sudah diklaim oleh operator lain.'
                });
            }
            await prisma.license.update({
                where: { licenseKey: cleanKey },
                data: { operatorPhone: nomor }
            });
            return reply.send({
                success: true,
                message: 'Kunci lisensi berhasil diklaim dan dikaitkan dengan nomor Anda.'
            });
        }
        catch (err) {
            console.error('[Claim License Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengklaim lisensi: ' + err.message });
        }
    });
    // 16. Client Auth: Get my orders
    fastify.get('/api/auth/my-orders', async (request, reply) => {
        await verifyClient(request, reply);
        if (reply.sent)
            return;
        const { nomor } = request.operator;
        try {
            const invoices = await prisma.invoice.findMany({
                where: {
                    license: {
                        operatorPhone: nomor,
                        productId: 'easy-tunnel'
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            const mapped = invoices.map(i => ({
                id: i.id,
                invoice_number: i.invoiceNumber,
                license_id: i.licenseId,
                school_name: i.schoolName,
                product_id: i.productId,
                plan_title: i.planTitle,
                amount: i.amount,
                status: i.status,
                payment_method: i.paymentMethod,
                expired_time: i.expiredTime,
                paid_at: i.paidAt ? i.paidAt.toISOString() : null,
                created_at: i.createdAt
            }));
            return reply.send({ success: true, count: mapped.length, data: mapped });
        }
        catch (err) {
            console.error('[Get Orders Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar order: ' + err.message });
        }
    });
    // 17. Public Key for Verification
    fastify.get('/api/license/public-key', async (_request, reply) => {
        return reply.send({ success: true, public_key: keys_1.PUBLIC_KEY });
    });
    // 18. System Config
    fastify.get('/api/license/system-config', async (_request, reply) => {
        try {
            const list = await prisma.systemSetting.findMany();
            const settings = {};
            list.forEach(row => {
                settings[row.key] = row.value;
            });
            return reply.send({ success: true, data: settings });
        }
        catch (err) {
            console.error(err);
            return reply.status(500).send({ success: false, message: 'Gagal memuat konfigurasi sistem pembayaran.' });
        }
    });
    // In-memory cache for payment channels
    let paymentChannelsCache = null;
    let cacheExpirationTime = 0;
    const FALLBACK_PAYMENT_CHANNELS = [
        { group: "Virtual Account", code: "BCAVA", name: "BCA Virtual Account", type: "direct", active: true, fee_flat: 5500, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/ytBKvaleGy1605201833.png" },
        { group: "Virtual Account", code: "BNIVA", name: "BNI Virtual Account", type: "direct", active: true, fee_flat: 4250, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/n22Qsh8jMa1583433577.png" },
        { group: "Virtual Account", code: "BRIVA", name: "BRI Virtual Account", type: "direct", active: true, fee_flat: 4250, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/8WQ3APST5s1579461828.png" },
        { group: "Virtual Account", code: "MANDIRIVA", name: "Mandiri Virtual Account", type: "direct", active: true, fee_flat: 4250, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/T9Z012UE331583531536.png" },
        { group: "Virtual Account", code: "PERMATAVA", name: "Permata Virtual Account", type: "direct", active: true, fee_flat: 4250, fee_percent: 0, icon_url: "https://assets.tripay.co.id/upload/payment-icon/szezRhAALB1583408731.png" },
        { group: "E-Wallet", code: "QRIS", name: "QRIS by ShopeePay", type: "direct", active: true, fee_flat: 750, fee_percent: 0.7, icon_url: "https://assets.tripay.co.id/upload/payment-icon/BpE4BPVyIw1605597490.png" }
    ];
    // 19. Payment Channels list
    fastify.get('/api/license/payment-channels', async (_request, reply) => {
        const currentTime = Date.now();
        let manualChannel = null;
        try {
            const manualEnabledRow = await prisma.systemSetting.findUnique({ where: { key: 'manual_payment_enabled' } }) || { value: '1' };
            if (manualEnabledRow.value === '1') {
                const bankNameRow = await prisma.systemSetting.findUnique({ where: { key: 'manual_bank_name' } }) || { value: 'BCA' };
                manualChannel = {
                    group: "Transfer Manual",
                    code: "Manual",
                    name: `Transfer Bank Manual (${bankNameRow.value})`,
                    type: "direct",
                    active: true,
                    fee_flat: 0,
                    fee_percent: 0,
                    icon_url: "https://img.icons8.com/fluency/96/bank-card-back-side.png",
                    minimum_amount: 10000,
                    maximum_amount: 50000000
                };
            }
        }
        catch (err) {
            console.error('[payment-channels] Failed to read manual payment settings:', err.message);
        }
        if (paymentChannelsCache && currentTime < cacheExpirationTime) {
            const resultData = [...paymentChannelsCache];
            if (manualChannel) {
                resultData.unshift(manualChannel);
            }
            return reply.send({ success: true, gateway_online: true, message: 'Success', data: resultData });
        }
        try {
            const fetch = require('node-fetch');
            const tripayApiUrl = process.env.TRIPAY_API_URL || 'https://tripay.co.id/api-sandbox';
            const tripayApiKey = process.env.TRIPAY_API_KEY;
            if (!tripayApiUrl || !tripayApiKey) {
                throw new Error('Tripay credentials are not properly configured.');
            }
            const response = await fetch(`${tripayApiUrl}/merchant/payment-channel`, {
                headers: { 'Authorization': `Bearer ${tripayApiKey}` },
                timeout: 2000
            });
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                const mappedData = data.data.map((channel) => {
                    const feeFlat = channel && channel.fee_customer && typeof channel.fee_customer.flat !== 'undefined'
                        ? (parseInt(channel.fee_customer.flat, 10) || 0)
                        : 0;
                    const feePercent = channel && channel.fee_customer && typeof channel.fee_customer.percent !== 'undefined'
                        ? (parseFloat(channel.fee_customer.percent) || 0)
                        : 0;
                    return {
                        ...channel,
                        fee_flat: feeFlat,
                        fee_percent: feePercent
                    };
                });
                paymentChannelsCache = mappedData;
                cacheExpirationTime = currentTime + (5 * 60 * 1000);
                const resultData = [...mappedData];
                if (manualChannel) {
                    resultData.unshift(manualChannel);
                }
                return reply.send({ success: true, gateway_online: true, message: 'Success', data: resultData });
            }
            throw new Error(data.message || 'API responded with success=false');
        }
        catch (err) {
            console.error('[payment-channels API Error] Fetching Tripay failed:', err.message);
            if (paymentChannelsCache) {
                const resultData = [...paymentChannelsCache];
                if (manualChannel) {
                    resultData.unshift(manualChannel);
                }
                return reply.send({ success: true, gateway_online: false, message: 'Serving from stale cache due to gateway error', data: resultData });
            }
            const resultData = [...FALLBACK_PAYMENT_CHANNELS];
            if (manualChannel) {
                resultData.unshift(manualChannel);
            }
            return reply.send({
                success: true,
                gateway_online: false,
                message: 'Serving offline fallback payment methods',
                data: resultData
            });
        }
    });
    // 20. SaaS provision status
    fastify.get('/api/license/provision-status/:slug', async (request, reply) => {
        const { slug } = request.params;
        const mainDomain = process.env.MAIN_DOMAIN || 'absenta.id';
        const domain = `${slug}.${mainDomain}`;
        const fs = require('fs');
        const configPath = `/etc/nginx/sites-available/${domain}`;
        const isCreated = fs.existsSync(configPath);
        return reply.send({
            success: true,
            slug,
            domain,
            status: isCreated ? 'completed' : 'pending',
            ssl_active: isCreated
        });
    });
    // 21. Check license key status
    fastify.get('/api/license/check/:key', async (request, reply) => {
        const { key } = request.params;
        try {
            const license = await prisma.license.findUnique({
                where: { licenseKey: key.trim() }
            });
            if (!license) {
                return reply.status(404).send({ success: false, message: 'Kunci lisensi tidak ditemukan.' });
            }
            const todayStr = new Date().toISOString().slice(0, 10);
            const expired = license.expiresAt < todayStr;
            const active = license.isActive === 1 && license.status === 'active' && !expired;
            const devices = await prisma.activatedDevice.findMany({
                where: { licenseId: license.id }
            });
            const mappedDevices = devices.map(d => ({
                device_id: d.deviceId,
                activated_at: d.activatedAt.toISOString()
            }));
            return reply.send({
                success: true,
                data: {
                    license_key: license.licenseKey,
                    product_id: license.productId,
                    school_name: license.schoolName,
                    device_limit: license.deviceLimit,
                    is_unlimited: license.isUnlimited,
                    is_active: active ? 1 : 0,
                    status: active ? 'active' : (expired ? 'expired' : 'pending'),
                    requested_slug: license.requestedSlug,
                    created_at: license.createdAt.toISOString(),
                    expires_at: license.expiresAt,
                    devices_count: devices.length,
                    devices: mappedDevices
                }
            });
        }
        catch (err) {
            console.error(err);
            return reply.status(500).send({ success: false, message: 'Gagal memeriksa status lisensi.' });
        }
    });
    // 22. Get school active subscriptions list
    fastify.get('/api/license/my-subscriptions/:key', async (request, reply) => {
        const { key } = request.params;
        try {
            const license = await prisma.license.findUnique({
                where: { licenseKey: key.trim() }
            });
            if (!license) {
                return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
            }
            const subs = await prisma.subscription.findMany({
                where: { licenseId: license.id },
                orderBy: { id: 'desc' }
            });
            const mapped = subs.map(s => ({
                id: s.id,
                license_id: s.licenseId,
                school_name: s.schoolName,
                product_id: s.productId,
                plan_id: s.planId,
                status: s.status,
                start_date: s.startDate,
                end_date: s.endDate,
                created_at: s.createdAt.toISOString()
            }));
            return reply.send({ success: true, data: mapped });
        }
        catch (err) {
            console.error(err);
            return reply.status(500).send({ success: false, message: 'Gagal memuat daftar langganan sekolah.' });
        }
    });
    // 23. Get school active invoices list
    fastify.get('/api/license/my-invoices/:key', async (request, reply) => {
        const { key } = request.params;
        try {
            const license = await prisma.license.findUnique({
                where: { licenseKey: key.trim() }
            });
            if (!license) {
                return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
            }
            const list = await prisma.invoice.findMany({
                where: { licenseId: license.id },
                orderBy: { createdAt: 'desc' }
            });
            const mapped = list.map(i => ({
                id: i.id,
                invoice_number: i.invoiceNumber,
                license_id: i.licenseId,
                school_name: i.schoolName,
                product_id: i.productId,
                plan_title: i.planTitle,
                amount: i.amount,
                status: i.status,
                payment_method: i.paymentMethod,
                expired_time: i.expiredTime,
                paid_at: i.paidAt ? i.paidAt.toISOString() : null,
                created_at: i.createdAt.toISOString(),
                requested_slug: license.requestedSlug
            }));
            return reply.send({ success: true, data: mapped });
        }
        catch (err) {
            console.error(err);
            return reply.status(500).send({ success: false, message: 'Gagal memuat riwayat invoice sekolah.' });
        }
    });
    // 24. Invoice status check
    fastify.get('/api/license/invoice-status/:invoiceNumber', async (request, reply) => {
        const { invoiceNumber } = request.params;
        try {
            const invoice = await prisma.invoice.findUnique({
                where: { invoiceNumber: invoiceNumber.trim() }
            });
            if (!invoice) {
                return reply.status(404).send({ success: false, message: 'Invoice tidak ditemukan.' });
            }
            return reply.send({
                success: true,
                data: {
                    invoice_number: invoice.invoiceNumber,
                    status: invoice.status,
                    paid_at: invoice.paidAt ? invoice.paidAt.toISOString() : null
                }
            });
        }
        catch (err) {
            console.error('[Invoice Status Error]', err);
            return reply.status(500).send({ success: false, message: 'Gagal mengecek status invoice.' });
        }
    });
    // 25. Activate license manually with Direct Input (CLIENT APP)
    fastify.post('/api/license/activate', async (request, reply) => {
        const body = request.body;
        const { license_key, device_id, product_id } = body;
        if (!license_key || !device_id) {
            return reply.status(400).send({ success: false, message: 'Kunci lisensi (key) dan Device ID wajib diisi.' });
        }
        const prodId = product_id || 'gform-orkestrator';
        const clientIp = request.ip;
        try {
            const license = await prisma.license.findFirst({
                where: {
                    licenseKey: license_key.trim(),
                    isActive: 1,
                    status: 'active'
                }
            });
            if (!license) {
                await (0, logger_1.logLicenseActivity)(license_key, prodId, clientIp, 'ACTIVATE_FAILED_NOT_FOUND');
                return reply.status(404).send({ success: false, message: 'Kunci lisensi tidak ditemukan, kedaluwarsa, atau belum disetujui.' });
            }
            if (license.productId !== prodId) {
                await (0, logger_1.logLicenseActivity)(license_key, prodId, clientIp, 'ACTIVATE_FAILED_PRODUCT_MISMATCH');
                return reply.status(400).send({
                    success: false,
                    message: `Lisensi ini diterbitkan untuk produk lain dan tidak dapat digunakan pada aplikasi ini.`
                });
            }
            const todayStr = new Date().toISOString().slice(0, 10);
            if (license.expiresAt < todayStr) {
                await (0, logger_1.logLicenseActivity)(license_key, prodId, clientIp, 'ACTIVATE_FAILED_EXPIRED');
                return reply.status(410).send({ success: false, message: 'Masa aktif lisensi ini sudah kedaluwarsa.' });
            }
            let vpnLicenseKey = null;
            if (license.includeVpn === 1 && license.requestedSlug) {
                try {
                    const vpnLic = await prisma.license.findFirst({
                        where: {
                            requestedSlug: license.requestedSlug.trim().toLowerCase(),
                            productId: 'vpn-tunnel',
                            isActive: 1
                        }
                    });
                    if (vpnLic) {
                        vpnLicenseKey = vpnLic.licenseKey;
                    }
                }
                catch (vpnErr) {
                    console.error('[VPN Key Fetch on Activate Error]', vpnErr);
                }
            }
            const alreadyActive = await prisma.activatedDevice.findUnique({
                where: {
                    licenseId_deviceId: {
                        licenseId: license.id,
                        deviceId: device_id
                    }
                }
            });
            if (alreadyActive) {
                const token = jsonwebtoken_1.default.sign({
                    license_key: license.licenseKey,
                    product_id: license.productId,
                    school_name: license.schoolName,
                    device_id,
                    expires_at: license.expiresAt,
                    include_vpn: license.includeVpn,
                    vpn_enabled: license.includeVpn,
                    vpn_license_key: vpnLicenseKey
                }, keys_1.PRIVATE_KEY, { algorithm: 'RS256', expiresIn: '365d' });
                await (0, logger_1.logLicenseActivity)(license_key, prodId, clientIp, 'ACTIVATE_RESTORED');
                return reply.send({
                    success: true,
                    message: 'Perangkat ini sudah terdaftar sebelumnya. Aktivasi dipulihkan.',
                    token,
                    school_name: license.schoolName,
                    expires_at: license.expiresAt,
                    include_vpn: license.includeVpn,
                    vpn_license_key: vpnLicenseKey
                });
            }
            const activeCount = await prisma.activatedDevice.count({
                where: { licenseId: license.id }
            });
            if (license.isUnlimited !== 1 && activeCount >= license.deviceLimit) {
                await (0, logger_1.logLicenseActivity)(license_key, prodId, clientIp, 'ACTIVATE_FAILED_LIMIT_REACHED');
                return reply.status(403).send({
                    success: false,
                    message: `Batas limit perangkat tercapai. Kunci lisensi ini hanya untuk maksimal ${license.deviceLimit} HP.`
                });
            }
            await prisma.activatedDevice.create({
                data: {
                    licenseId: license.id,
                    deviceId: device_id
                }
            });
            const token = jsonwebtoken_1.default.sign({
                license_key: license.licenseKey,
                product_id: license.productId,
                school_name: license.schoolName,
                device_id,
                expires_at: license.expiresAt,
                include_vpn: license.includeVpn,
                vpn_enabled: license.includeVpn,
                vpn_license_key: vpnLicenseKey
            }, keys_1.PRIVATE_KEY, { algorithm: 'RS256', expiresIn: '365d' });
            await (0, logger_1.logLicenseActivity)(license_key, prodId, clientIp, 'ACTIVATE_SUCCESS');
            return reply.send({
                success: true,
                message: 'Aktivasi lisensi berhasil dipublikasikan untuk perangkat ini.',
                token,
                school_name: license.schoolName,
                expires_at: license.expiresAt,
                include_vpn: license.includeVpn,
                vpn_license_key: vpnLicenseKey
            });
        }
        catch (err) {
            console.error(err);
            return reply.status(500).send({ success: false, message: 'Terjadi kesalahan sistem saat memproses aktivasi.' });
        }
    });
    // 26. Verify license JWT (CLIENT APP BACKGROUND CHECK)
    fastify.post('/api/license/verify', async (request, reply) => {
        const { token } = request.body;
        if (!token) {
            return reply.status(400).send({ success: false, message: 'Token verifikasi tidak ditemukan.' });
        }
        const clientIp = request.ip;
        try {
            const decoded = jsonwebtoken_1.default.verify(token, keys_1.PUBLIC_KEY, { algorithms: ['RS256'] });
            const license = await prisma.license.findFirst({
                where: {
                    licenseKey: decoded.license_key,
                    isActive: 1,
                    status: 'active'
                }
            });
            if (!license) {
                await (0, logger_1.logLicenseActivity)(decoded.license_key, decoded.product_id, clientIp, 'VERIFY_FAILED_REVOKED');
                return reply.status(401).send({ success: false, message: 'Lisensi dibatalkan atau dinonaktifkan oleh administrator.' });
            }
            const todayStr = new Date().toISOString().slice(0, 10);
            if (license.expiresAt < todayStr) {
                await (0, logger_1.logLicenseActivity)(decoded.license_key, decoded.product_id, clientIp, 'VERIFY_FAILED_EXPIRED');
                return reply.status(401).send({ success: false, message: 'Lisensi ini sudah habis masa berlakunya.' });
            }
            const deviceRecord = await prisma.activatedDevice.findUnique({
                where: {
                    licenseId_deviceId: {
                        licenseId: license.id,
                        deviceId: decoded.device_id
                    }
                }
            });
            if (!deviceRecord) {
                await (0, logger_1.logLicenseActivity)(decoded.license_key, decoded.product_id, clientIp, 'VERIFY_FAILED_DEVICE_UNAUTHORIZED');
                return reply.status(401).send({ success: false, message: 'Perangkat ini dide-otorisasi dari lisensi.' });
            }
            await (0, logger_1.logLicenseActivity)(decoded.license_key, decoded.product_id, clientIp, 'VERIFY_ONLINE_SUCCESS');
            return reply.send({
                success: true,
                message: 'Lisensi valid dan terverifikasi online.',
                data: {
                    school_name: license.schoolName,
                    expires_at: license.expiresAt,
                    device_id: decoded.device_id,
                    product_id: license.productId
                }
            });
        }
        catch (err) {
            return reply.status(401).send({ success: false, message: 'Sesi lisensi kedaluwarsa atau tidak valid.' });
        }
    });
    // 27. Upload manual receipt
    fastify.post('/api/license/upload-receipt', async (request, reply) => {
        const { license_key, image } = request.body;
        if (!license_key || !image) {
            return reply.status(400).send({ success: false, message: 'Kunci Lisensi dan Gambar Bukti Transfer wajib dikirim.' });
        }
        const clientIp = request.ip;
        try {
            const license = await prisma.license.findUnique({
                where: { licenseKey: license_key.trim() }
            });
            if (!license) {
                return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
            }
            const lastInvoice = await prisma.invoice.findFirst({
                where: { licenseId: license.id },
                orderBy: { createdAt: 'desc' }
            });
            if (!lastInvoice) {
                return reply.status(404).send({ success: false, message: 'Tagihan untuk lisensi ini tidak ditemukan.' });
            }
            const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return reply.status(400).send({ success: false, message: 'Format base64 gambar bukti bayar tidak valid.' });
            }
            const fileExtension = matches[1].split('/')[1] || 'png';
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            const fs = require('fs');
            const path = require('path');
            const uploadDir = path.join(__dirname, '../../public/uploads/receipts');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            const filename = `${lastInvoice.invoiceNumber}_${Date.now()}.${fileExtension}`;
            const targetPath = path.join(uploadDir, filename);
            fs.writeFileSync(targetPath, buffer);
            const relativePath = `/uploads/receipts/${filename}`;
            await prisma.invoice.update({
                where: { id: lastInvoice.id },
                data: { paymentProof: relativePath }
            });
            await (0, logger_1.logLicenseActivity)(license_key, license.productId, clientIp, 'RECEIPT_UPLOAD_SUCCESS');
            return reply.send({
                success: true,
                message: 'Bukti transfer berhasil diunggah! Mohon tunggu konfirmasi admin.',
                data: {
                    payment_proof: relativePath
                }
            });
        }
        catch (err) {
            console.error('[RECEIPT UPLOAD ERROR]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengunggah gambar bukti transfer di server.' });
        }
    });
    // 28. Download APK
    fastify.get('/download-apk', async (request, reply) => {
        const fs = require('fs');
        const path = require('path');
        const apkPath = path.join(__dirname, '../../public/Orkestrator Ujian.apk');
        const clientIp = request.ip;
        if (fs.existsSync(apkPath)) {
            console.log(`[Download APK] ✓ Serving local static APK instantly to ${clientIp}`);
            try {
                const metaPath = path.join(__dirname, '../../public/build-meta.json');
                let meta = { downloadCount: 0 };
                if (fs.existsSync(metaPath)) {
                    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                }
                meta.downloadCount = (meta.downloadCount || 0) + 1;
                fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
            }
            catch (e) {
                console.error('[Download APK Counter Error]', e.message);
            }
            return reply.sendFile('Orkestrator Ujian.apk');
        }
        return reply.status(404).send({ success: false, message: 'File APK tidak ditemukan di server.' });
    });
    // 29. Update custom domain for tunnel
    fastify.post('/api/license/tunnel/custom-domain', async (request, reply) => {
        const { license_key, custom_domain } = request.body;
        if (!license_key) {
            return reply.status(400).send({ success: false, message: 'License key wajib diisi.' });
        }
        try {
            const license = await prisma.license.findFirst({
                where: { licenseKey: license_key.trim(), isActive: 1 }
            });
            if (!license) {
                return reply.status(403).send({ success: false, message: 'Lisensi tidak ditemukan atau tidak aktif.' });
            }
            const slug = license.requestedSlug;
            if (!slug) {
                return reply.status(400).send({ success: false, message: 'Lisensi belum di-online-kan (belum memiliki slug/IP).' });
            }
            let targetDomain = null;
            if (custom_domain) {
                targetDomain = custom_domain.trim().toLowerCase();
                const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/;
                if (!domainRegex.test(targetDomain)) {
                    return reply.status(400).send({ success: false, message: 'Format domain kustom tidak valid. Contoh: zakat.sekolah.sch.id' });
                }
            }
            await prisma.license.update({
                where: { id: license.id },
                data: { customDomain: targetDomain }
            });
            await (0, caddy_service_1.triggerCaddySync)();
            return reply.send({
                success: true,
                message: targetDomain
                    ? `Domain kustom '${targetDomain}' berhasil disinkronkan ke cloud gateway.`
                    : 'Domain kustom berhasil dinonaktifkan di cloud gateway.',
                custom_domain: targetDomain
            });
        }
        catch (err) {
            console.error('[Tunnel Custom Domain Sync Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal sinkronisasi domain kustom ke VPS: ' + err.message });
        }
    });
    // 30. Easy Tunnel: Update Local Port
    fastify.post('/api/license/easy-tunnel/update-port', async (request, reply) => {
        const { license_key, local_port } = request.body;
        if (!license_key || !local_port) {
            return reply.status(400).send({ success: false, message: 'license_key dan local_port wajib diisi.' });
        }
        const portNum = parseInt(local_port, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            return reply.status(400).send({ success: false, message: 'Port lokal tidak valid (1-65535).' });
        }
        try {
            const license = await prisma.license.findFirst({
                where: {
                    licenseKey: license_key.trim(),
                    productId: 'easy-tunnel'
                }
            });
            if (!license) {
                return reply.status(404).send({ success: false, message: 'Lisensi Easy Tunnel tidak ditemukan.' });
            }
            if (license.isActive !== 1) {
                return reply.status(403).send({ success: false, message: 'Lisensi Easy Tunnel tidak aktif.' });
            }
            await prisma.license.update({
                where: { id: license.id },
                data: { localPort: portNum }
            });
            await (0, caddy_service_1.triggerCaddySync)();
            return reply.send({
                success: true,
                message: `Port lokal berhasil diubah ke ${portNum} di cloud gateway.`
            });
        }
        catch (err) {
            console.error('[Tunnel Change Port Sync Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengubah port di VPS: ' + err.message });
        }
    });
    // 31. Easy Tunnel: Release License (Device Unlock)
    fastify.post('/api/license/easy-tunnel/release', async (request, reply) => {
        const { license_key } = request.body;
        if (!license_key) {
            return reply.status(400).send({ success: false, message: 'license_key wajib diisi.' });
        }
        try {
            const license = await prisma.license.findFirst({
                where: {
                    licenseKey: license_key.trim(),
                    productId: 'easy-tunnel'
                }
            });
            if (!license) {
                return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
            }
            await prisma.license.update({
                where: { id: license.id },
                data: { activeHostname: null }
            });
            console.log(`[Easy Tunnel] Released active device lock for license: ${license_key}`);
            return reply.send({
                success: true,
                message: 'Kunci perangkat (device lock) berhasil dilepas.'
            });
        }
        catch (err) {
            console.error('[Tunnel Release Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal melepas kunci perangkat: ' + err.message });
        }
    });
};
exports.licenseRoutes = licenseRoutes;
