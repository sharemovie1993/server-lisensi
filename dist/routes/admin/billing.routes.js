"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBillingRoutes = void 0;
exports.processPrivateerTopUp = processPrivateerTopUp;
const helpers_1 = require("../license/helpers");
const middleware_1 = require("./middleware");
const caddy_service_1 = require("../../services/caddy.service");
const settings_service_1 = require("../../config/settings.service");
const http_1 = require("../../utils/http");
const whatsapp_service_1 = require("../../services/whatsapp.service");
async function processPrivateerTopUp(invoice) {
    const cleanPhone = (0, helpers_1.formatWA)(invoice.licenseId);
    const studentName = invoice.schoolName || 'Siswa';
    // Extract sessions count from plan title, e.g. "10 Sesi Belajar" -> 10
    const sessions = parseInt(invoice.planTitle) || 0;
    if (sessions <= 0) {
        throw new Error('Sesi tidak valid pada Invoice planTitle');
    }
    // 1. Upsert UserCredit
    const userCredit = await helpers_1.prisma.userCredit.upsert({
        where: { phone: cleanPhone },
        update: {
            balance: { increment: sessions },
            studentName: studentName
        },
        create: {
            phone: cleanPhone,
            balance: sessions,
            studentName: studentName
        }
    });
    // 2. Create TopUpTransaction
    await helpers_1.prisma.topUpTransaction.create({
        data: {
            userCreditId: userCredit.id,
            amount: sessions,
            pricePaid: invoice.amount || 0,
            invoiceNumber: invoice.invoiceNumber,
            status: 'PAID',
            paidAt: new Date()
        }
    });
    // 3. Send WhatsApp Lunas Notification
    const message = `*💎 [Privateer] TOP-UP BERHASIL (CONFIRMED)*\n\n` +
        `Halo *${studentName}*, pembayaran invoice Anda telah kami konfirmasi secara otomatis. Kuota belajar Anda telah ditambahkan.\n\n` +
        `*📋 Rincian Top-up:*\n` +
        `- *No. Transaksi*: ${invoice.invoiceNumber}\n` +
        `- *Tambahan Sesi*: *+${sessions} Sesi Belajar*\n` +
        `- *Status*: ✅ *LUNAS*\n\n` +
        `*💳 Saldo Sesi Belajar Anda Sekarang:*\n` +
        `- *Total Saldo*: *${userCredit.balance} Sesi Belajar*\n\n` +
        `Terima kasih. Selamat belajar di Privateer! ✨🚀`;
    await whatsapp_service_1.waGateway.sendMessage(cleanPhone, message, 'TOPUP_AUTO_CONFIRM', 'privateer');
}
const registerBillingRoutes = (fastify) => {
    // GET /api/admin/revenue (Get total revenue stats)
    fastify.get('/api/admin/revenue', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const paidInvoices = await helpers_1.prisma.invoice.findMany({
                where: { status: 'paid' }
            });
            const total = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
            return reply.send({
                success: true,
                data: {
                    total_revenue: total,
                    formatted_revenue: `Rp ${total.toLocaleString('id-ID')}`
                }
            });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mengambil laporan pendapatan.' });
        }
    });
    // GET /api/admin/invoices (Get all invoices)
    fastify.get('/api/admin/invoices', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const list = await helpers_1.prisma.invoice.findMany({
                orderBy: { createdAt: 'desc' }
            });
            const mapped = list.map(i => ({
                id: i.id,
                invoice_number: i.invoiceNumber,
                license_id: i.licenseId,
                school_name: i.schoolName,
                product_id: (0, helpers_1.normalizeProductId)(i.productId),
                plan_title: i.planTitle,
                amount: i.amount,
                status: i.status,
                payment_method: i.paymentMethod,
                expired_time: i.expiredTime,
                paid_at: i.paidAt ? i.paidAt.toISOString() : null,
                created_at: i.createdAt,
                payment_instructions: i.paymentInstructions,
                payment_proof: i.paymentProof
            }));
            return reply.send({ success: true, data: mapped });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar invoice.' });
        }
    });
    // GET /api/admin/subscriptions (Get all subscriptions)
    fastify.get('/api/admin/subscriptions', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const [list, plans, products, paidInvoices] = await Promise.all([
                helpers_1.prisma.subscription.findMany({
                    include: {
                        license: true
                    },
                    orderBy: { id: 'desc' }
                }),
                helpers_1.prisma.plan.findMany(),
                helpers_1.prisma.product.findMany(),
                helpers_1.prisma.invoice.findMany({
                    where: { status: { in: ['paid', 'PAID'] } },
                    select: { licenseId: true }
                })
            ]);
            const planMap = new Map(plans.map(p => [p.id, p]));
            const productMap = new Map(products.map(p => [p.id, p]));
            const paidLicenseIds = new Set(paidInvoices.map(inv => inv.licenseId));
            const mapped = list.map(s => {
                const plan = planMap.get(s.planId);
                const parts = s.schoolName ? s.schoolName.split('|') : [];
                const namePart = parts[0] ? parts[0].trim() : '';
                const realSchoolName = namePart || s.license?.schoolName || 'Sekolah Tidak Dikenal';
                const slug = parts[1] ? parts[1].trim() : (s.license?.requestedSlug || '');
                const licenseKey = s.license?.licenseKey || '';
                const cleanProductId = (0, helpers_1.normalizeProductId)(s.productId);
                const prod = productMap.get(cleanProductId) || productMap.get(s.productId);
                const productName = prod ? prod.name : 'Platform Cakola';
                const rawPlanName = s.planId === 'saas-node' ? 'Akses Portal Utama' : (plan ? plan.name : s.planId || 'Standard');
                const isTrial = s.licenseId ? !paidLicenseIds.has(s.licenseId) : true;
                return {
                    id: s.id,
                    license_id: s.licenseId,
                    licenseId: s.licenseId,
                    school_name: realSchoolName,
                    schoolName: realSchoolName,
                    tenant_id: realSchoolName,
                    tenantId: realSchoolName,
                    slug,
                    licenseKey,
                    serverName: s.license?.schoolName || 'Server Induk',
                    server_name: s.license?.schoolName || 'Server Induk',
                    serverLastHeartbeatAt: s.license?.lastHeartbeatAt || null,
                    product_id: (0, helpers_1.normalizeProductId)(s.productId),
                    productId: (0, helpers_1.normalizeProductId)(s.productId),
                    productName,
                    product_name: productName,
                    plan_id: s.planId,
                    planId: s.planId,
                    plan_name: rawPlanName,
                    planName: rawPlanName,
                    status: s.status ? s.status.toUpperCase() : 'PENDING',
                    start_date: s.startDate,
                    startDate: s.startDate,
                    end_date: s.endDate,
                    endDate: s.endDate,
                    created_at: s.createdAt,
                    createdAt: s.createdAt,
                    isTrial
                };
            });
            return reply.send({ success: true, data: mapped });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mengambil daftar langganan.' });
        }
    });
    // GET /api/admin/privateer/topups (Get Privateer topups history)
    fastify.get('/api/admin/privateer/topups', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        try {
            const [credits, transactions] = await Promise.all([
                helpers_1.prisma.userCredit.findMany({
                    orderBy: { balance: 'desc' }
                }),
                helpers_1.prisma.topUpTransaction.findMany({
                    include: {
                        userCredit: true
                    },
                    orderBy: { createdAt: 'desc' }
                })
            ]);
            const mappedCredits = credits.map(c => ({
                id: c.id,
                phone: c.phone,
                balance: c.balance,
                studentName: c.studentName,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt
            }));
            const mappedTx = transactions.map(t => ({
                id: t.id,
                phone: t.userCredit.phone,
                studentName: t.userCredit.studentName || 'Siswa',
                amount: t.amount,
                pricePaid: t.pricePaid,
                invoiceNumber: t.invoiceNumber,
                status: t.status,
                paidAt: t.paidAt,
                createdAt: t.createdAt
            }));
            return reply.send({
                success: true,
                data: {
                    credits: mappedCredits,
                    transactions: mappedTx
                }
            });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal mengambil riwayat top-up Privateer: ' + err.message });
        }
    });
    // POST /api/admin/privateer/manual-topup (Process Manual Top-up for Privateer)
    fastify.post('/api/admin/privateer/manual-topup', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { phone, studentName, sessions, price } = request.body;
        if (!phone || !studentName || !sessions) {
            return reply.status(400).send({ success: false, message: 'Parameter phone, studentName, dan sessions wajib diisi.' });
        }
        try {
            const cleanPhone = (0, helpers_1.formatWA)(phone);
            const invoiceNumber = `INV-PVT-MAN-${Math.floor(1000 + Math.random() * 9000)}-${new Date().getFullYear()}`;
            const userCredit = await helpers_1.prisma.userCredit.upsert({
                where: { phone: cleanPhone },
                update: {
                    balance: { increment: sessions },
                    studentName: studentName
                },
                create: {
                    phone: cleanPhone,
                    balance: sessions,
                    studentName: studentName
                }
            });
            await helpers_1.prisma.topUpTransaction.create({
                data: {
                    userCreditId: userCredit.id,
                    amount: sessions,
                    pricePaid: price || 0,
                    invoiceNumber: invoiceNumber,
                    status: 'PAID',
                    paidAt: new Date()
                }
            });
            const message = `*💎 [Privateer] TOP-UP MANUAL BERHASIL (CASH)*\n\n` +
                `Halo *${studentName}*, kuota belajar Anda telah ditambahkan oleh Admin.\n\n` +
                `*📋 Rincian Top-up:*\n` +
                `- *No. Transaksi*: ${invoiceNumber}\n` +
                `- *Tambahan Sesi*: *+${sessions} Sesi Belajar*\n` +
                `- *Status*: ✅ *DITERIMA & LUNAS*\n\n` +
                `*💳 Saldo Sesi Belajar Anda Sekarang:*\n` +
                `- *Total Saldo*: *${userCredit.balance} Sesi Belajar*\n\n` +
                `Terima kasih. Selamat belajar di Privateer! ✨🚀`;
            await whatsapp_service_1.waGateway.sendMessage(cleanPhone, message, 'TOPUP_MANUAL', 'privateer');
            return reply.send({
                success: true,
                message: 'Top-up manual berhasil diproses dan saldo telah ditambahkan.',
                data: userCredit
            });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal memproses top-up manual: ' + err.message });
        }
    });
    // POST /api/admin/subscriptions/migrate (Migrate all school subscriptions to another server)
    fastify.post('/api/admin/subscriptions/migrate', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { schoolName, targetLicenseId } = request.body;
        if (!schoolName || !targetLicenseId) {
            return reply.status(400).send({ success: false, message: 'Parameter schoolName dan targetLicenseId wajib diisi.' });
        }
        try {
            const targetLic = await helpers_1.prisma.license.findUnique({
                where: { id: targetLicenseId }
            });
            if (!targetLic) {
                return reply.status(404).send({ success: false, message: 'Server target tidak ditemukan.' });
            }
            const updateRes = await helpers_1.prisma.subscription.updateMany({
                where: { schoolName: { startsWith: schoolName } },
                data: { licenseId: targetLicenseId }
            });
            if (targetLic.productId !== 'privateer') {
                await (0, caddy_service_1.triggerCaddySync)();
            }
            return reply.send({
                success: true,
                message: `Berhasil memindahkan ${updateRes.count} langganan sekolah ke server ${targetLic.schoolName}.`,
            });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal memindahkan server: ' + err.message });
        }
    });
    // POST /api/admin/invoices/pay/:id (Manually mark invoice as paid)
    fastify.post('/api/admin/invoices/pay/:id', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        try {
            const invoice = await helpers_1.prisma.invoice.findUnique({
                where: { id: id }
            });
            if (!invoice) {
                return reply.status(404).send({ success: false, message: 'Invoice tidak ditemukan.' });
            }
            if (invoice.status === 'paid') {
                return reply.send({ success: true, message: 'Invoice sudah lunas.' });
            }
            const updatedInvoice = await helpers_1.prisma.invoice.update({
                where: { id: id },
                data: { status: 'paid', paidAt: new Date() }
            });
            if ((0, helpers_1.normalizeProductId)(invoice.productId) === 'privateer') {
                await processPrivateerTopUp(updatedInvoice);
                return reply.send({ success: true, message: 'Transaksi Privateer dikonfirmasi & sesi berhasil ditambahkan!' });
            }
            const planId = invoice.planId || '';
            let days = 30;
            if (planId.toLowerCase().includes('tahun') || planId.toLowerCase().includes('annual') || planId.toLowerCase().includes('yearly'))
                days = 365;
            else if (planId.toLowerCase().includes('sem') || planId.toLowerCase().includes('semester'))
                days = 180;
            else if (planId.toLowerCase().includes('lifetime'))
                days = 3650;
            const baseDate = new Date();
            baseDate.setDate(baseDate.getDate() + days);
            const expiresStr = baseDate.toISOString().slice(0, 10);
            const lic = await helpers_1.prisma.license.update({
                where: { id: invoice.licenseId },
                data: { status: 'active', isActive: 1, expiresAt: expiresStr }
            });
            const existingSub = await helpers_1.prisma.subscription.findFirst({
                where: {
                    licenseId: lic.id,
                    planId,
                    schoolName: invoice.schoolName
                }
            });
            if (existingSub) {
                await helpers_1.prisma.subscription.update({
                    where: { id: existingSub.id },
                    data: {
                        status: 'active',
                        startDate: new Date().toISOString().slice(0, 10),
                        endDate: expiresStr,
                        schoolName: invoice.schoolName
                    }
                });
            }
            else {
                await helpers_1.prisma.subscription.create({
                    data: {
                        licenseId: lic.id,
                        schoolName: invoice.schoolName,
                        productId: lic.productId,
                        planId,
                        status: 'active',
                        startDate: new Date().toISOString().slice(0, 10),
                        endDate: expiresStr
                    }
                });
            }
            if (lic.requestedSlug) {
                const dbMainDomain = await (0, settings_service_1.getSetting)('main_domain', 'absenta.id');
                const schoolDomain = `https://${lic.requestedSlug}.${dbMainDomain}`;
                const callbackUrl = `${schoolDomain}/api/billing/subscriptions/license/callback`;
                (0, http_1.httpPost)(callbackUrl, { license_key: lic.licenseKey, tenant_id: lic.requestedSlug }, {}, 6000)
                    .then(res => console.log('[Manual Approval Callback Push Success]', res.status))
                    .catch(err => console.log('[Manual Approval Callback Push Offline/NAT]', err.message));
            }
            if (invoice.productId !== 'privateer' && lic.productId !== 'privateer') {
                await (0, caddy_service_1.triggerCaddySync)();
            }
            return reply.send({ success: true, message: 'Invoice berhasil dikonfirmasi lunas secara manual!' });
        }
        catch (err) {
            console.error('[Manual Approval Error]', err.message);
            return reply.status(500).send({ success: false, message: 'Gagal mengonfirmasi invoice: ' + err.message });
        }
    });
    // POST /api/admin/subscriptions/bulk-delete (Bulk delete subscriptions)
    fastify.post('/api/admin/subscriptions/bulk-delete', async (request, reply) => {
        await (0, middleware_1.verifyAdmin)(request, reply);
        if (reply.sent)
            return;
        const { ids } = request.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return reply.status(400).send({ success: false, message: 'ID langganan tidak valid.' });
        }
        try {
            await helpers_1.prisma.subscription.deleteMany({
                where: { id: { in: ids } }
            });
            return reply.send({ success: true, message: `${ids.length} langganan berhasil dihapus.` });
        }
        catch (err) {
            return reply.status(500).send({ success: false, message: 'Gagal menghapus langganan: ' + err.message });
        }
    });
};
exports.registerBillingRoutes = registerBillingRoutes;
