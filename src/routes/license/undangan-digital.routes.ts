import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { prisma, formatWA } from './helpers';
import { waGateway } from '../../services/whatsapp.service';

/**
 * Undangan Digital Dedicated Routes
 * ProductId: 'undangan-digital'
 */
export const registerUndanganDigitalLicenseRoutes = (fastify: FastifyInstance) => {

  /**
   * 1. GET /api/license/undangan-digital/packages
   * Mengambil semua paket aktif untuk produk undangan-digital
   */
  fastify.get('/api/license/undangan-digital/packages', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Pastikan produk undangan-digital ada di database
      let product = await prisma.product.findUnique({ where: { id: 'undangan-digital' } });
      if (!product) {
        product = await prisma.product.create({
          data: {
            id: 'undangan-digital',
            name: 'Undangan Digital Multi-Event & Print Kit',
            prefix: 'UND'
          }
        });
      }

      let plans = await prisma.plan.findMany({
        where: { productId: 'undangan-digital', isActive: true },
        orderBy: { priceMonthly: 'asc' }
      });

      // Jika belum ada plan, inisialisasi default plan
      if (plans.length === 0) {
        const defaultPlans = [
          {
            id: 'UND-BASIC',
            productId: 'undangan-digital',
            name: 'Paket Hemat (Khitan & Ultah)',
            type: 'SOFTWARE_ONETIME',
            priceMonthly: 49000,
            priceYearly: 49000,
            priceOnetime: 49000,
            deviceLimit: 1,
            billingPeriod: 'onetime',
            featuresJson: [
              '1 Acara Aktif',
              'Pilihan Tema Standar',
              'Buku Tamu & RSVP',
              'Amplop Digital',
              'Masa Aktif 3 Bulan'
            ]
          },
          {
            id: 'UND-GOLD',
            productId: 'undangan-digital',
            name: 'Paket Wedding Gold (All Features)',
            type: 'SOFTWARE_ONETIME',
            priceMonthly: 99000,
            priceYearly: 99000,
            priceOnetime: 99000,
            deviceLimit: 1,
            billingPeriod: 'onetime',
            featuresJson: [
              'Semua Fitur Wedding Lengkap',
              'Semua Tema Luxury (Gold, Sage, Navy)',
              'Buku Tamu & RSVP Realtime',
              'Amplop Digital + QRIS',
              'Piringan Musik Melayang',
              'Tanpa Watermark',
              'Masa Aktif 1 Tahun'
            ]
          },
          {
            id: 'UND-PLATINUM',
            productId: 'undangan-digital',
            name: 'Paket Platinum + Print-Ready Kit',
            type: 'SOFTWARE_ONETIME',
            priceMonthly: 149000,
            priceYearly: 149000,
            priceOnetime: 149000,
            deviceLimit: 1,
            billingPeriod: 'onetime',
            featuresJson: [
              'Semua Fitur Paket Gold',
              'Generator Cetak PDF HD (300 DPI A5/4R/Bifold)',
              'Generator Label Stiker Tamu No. 103 & 121',
              'Kartu Souvenir & Voucher Siap Cetak',
              'QR Scanner Check-in Resepsi',
              'Kirim WhatsApp Blast Assistant',
              'Masa Aktif Selamanya'
            ]
          },
          {
            id: 'UND-RESELLER',
            productId: 'undangan-digital',
            name: 'Paket Reseller / Percetakan (10 Slot)',
            type: 'SOFTWARE_ONETIME',
            priceMonthly: 450000,
            priceYearly: 450000,
            priceOnetime: 450000,
            deviceLimit: 10,
            billingPeriod: 'onetime',
            featuresJson: [
              'Kuota 10 Undangan Aktif',
              'Fitur Platinum Lengkap di Semua Slot',
              'Download Print Kit Sepuasnya',
              'Dukungan Custom Domain / Subdomain',
              'Dashboard Manajemen Vendor'
            ]
          }
        ];

        for (const p of defaultPlans) {
          await prisma.plan.create({ data: p });
        }

        plans = await prisma.plan.findMany({
          where: { productId: 'undangan-digital', isActive: true },
          orderBy: { priceMonthly: 'asc' }
        });
      }

      return reply.send({ success: true, data: plans });
    } catch (err: any) {
      console.error('[Undangan Digital Packages Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal mengambil paket undangan.' });
    }
  });

  /**
   * 2. POST /api/license/undangan-digital/create-order
   * Membuat invoice Tripay untuk aktivasi undangan digital
   */
  fastify.post('/api/license/undangan-digital/create-order', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      plan_id: string;
      customer_name: string;
      customer_phone: string;
      invitation_title: string;
      slug?: string;
      payment_method?: string;
    };

    const { plan_id, customer_name, customer_phone, invitation_title, slug, payment_method } = body;

    if (!plan_id || !customer_name || !customer_phone) {
      return reply.status(400).send({ success: false, message: 'Data pesanan tidak lengkap.' });
    }

    try {
      const plan = await prisma.plan.findUnique({ where: { id: plan_id } });
      if (!plan) {
        return reply.status(404).send({ success: false, message: 'Paket tidak ditemukan.' });
      }

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-UND-${randomSuffix}-${Date.now().toString().slice(-4)}`;
      const amount = plan.priceMonthly;

      // Generate license key placeholder
      const licenseKey = `UND-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Buat lisensi di status pending
      const license = await prisma.license.create({
        data: {
          licenseKey,
          productId: 'undangan-digital',
          schoolName: `${customer_name} - ${invitation_title || 'Undangan Digital'}`,
          deviceLimit: plan.deviceLimit,
          isUnlimited: plan.id === 'UND-RESELLER' ? 0 : 1,
          expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
          status: 'pending',
          isActive: 0,
          planId: plan.id,
          operatorPhone: customer_phone,
          requestedSlug: slug || null
        }
      });

      // Integrasi Tripay jika tersedia di env
      const TRIPAY_API_KEY = process.env.TRIPAY_API_KEY || '';
      const TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY || '';
      const TRIPAY_MERCHANT_CODE = process.env.TRIPAY_MERCHANT_CODE || '';
      const TRIPAY_API_URL = process.env.TRIPAY_API_URL || 'https://tripay.co.id/api-sandbox';

      let paymentData: any = {
        invoice_number: invoiceNumber,
        amount,
        payment_method: payment_method || 'QRIS2',
        qr_url: null,
        pay_code: null,
        instructions: ['Scan kode QR menggunakan GoPay, OVO, DANA, BCA Mobile, atau ShopeePay.']
      };

      if (TRIPAY_API_KEY && TRIPAY_PRIVATE_KEY && TRIPAY_MERCHANT_CODE) {
        try {
          const signature = crypto
            .createHmac('sha256', TRIPAY_PRIVATE_KEY)
            .update(TRIPAY_MERCHANT_CODE + invoiceNumber + amount)
            .digest('hex');

          const fetch = require('node-fetch');
          const response = await fetch(`${TRIPAY_API_URL}/transaction/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${TRIPAY_API_KEY}`
            },
            body: JSON.stringify({
              method: payment_method || 'QRIS2',
              merchant_ref: invoiceNumber,
              amount,
              customer_name,
              customer_email: 'customer@undangan.id',
              customer_phone: customer_phone,
              order_items: [{ sku: plan.id, name: plan.name, price: amount, quantity: 1 }],
              expired_time: Math.floor(Date.now() / 1000) + 24 * 3600,
              signature
            }),
            timeout: 5000
          });
          const tripayRes = await response.json();
          if (tripayRes.success && tripayRes.data) {
            paymentData.qr_url = tripayRes.data.qr_url || null;
            paymentData.pay_code = tripayRes.data.pay_code || null;
            paymentData.instructions = tripayRes.data.instructions || paymentData.instructions;
          }
        } catch (e: any) {
          console.warn('[Tripay Request Warn]', e.message);
        }
      }

      // Simpan invoice ke DB Server Lisensi
      await prisma.invoice.create({
        data: {
          invoiceNumber,
          licenseId: license.id,
          schoolName: `${customer_name} - ${invitation_title}`,
          productId: 'undangan-digital',
          planTitle: plan.name,
          amount,
          status: 'unpaid',
          paymentMethod: payment_method || 'QRIS2',
          paymentInstructions: paymentData,
          expiredTime: String(Math.floor(Date.now() / 1000) + 24 * 3600),
          planId: plan.id
        }
      });

      // Kirim Notifikasi WA jika nomor valid & bot aktif
      const formattedPhone = formatWA(customer_phone);
      if (formattedPhone && waGateway) {
        const msg = `*TAGIHAN PEMESANAN UNDANGAN DIGITAL*\n\nHalo *${customer_name}*,\nInvoice pesanan Anda telah dibuat:\n\n` +
          `• No Invoice: *${invoiceNumber}*\n` +
          `• Paket: *${plan.name}*\n` +
          `• Total: *Rp ${amount.toLocaleString('id-ID')}*\n` +
          `• Metode: *${payment_method || 'QRIS'}*\n\n` +
          `Silakan selesaikan pembayaran untuk mengaktifkan seluruh fitur premium dan mencetak undangan.\nTerima kasih!`;

        waGateway.sendMessage(formattedPhone, msg, 'INVOICE_CREATED', 'undangan-digital').catch(() => {});
      }

      return reply.send({
        success: true,
        data: {
          invoice_number: invoiceNumber,
          license_key: licenseKey,
          amount,
          plan_name: plan.name,
          payment_data: paymentData
        }
      });
    } catch (err: any) {
      console.error('[Create Order Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal membuat pesanan invoice.' });
    }
  });

  /**
   * 3. GET /api/license/undangan-digital/check-status/:invoice_number
   */
  fastify.get('/api/license/undangan-digital/check-status/:invoice_number', async (request: FastifyRequest, reply: FastifyReply) => {
    const { invoice_number } = request.params as { invoice_number: string };
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { invoiceNumber: invoice_number },
        include: { license: true }
      });

      if (!invoice) {
        return reply.status(404).send({ success: false, message: 'Invoice tidak ditemukan.' });
      }

      return reply.send({
        success: true,
        data: {
          invoice_number: invoice.invoiceNumber,
          status: invoice.status,
          amount: invoice.amount,
          paid_at: invoice.paidAt,
          license_key: invoice.license.licenseKey,
          is_active: invoice.license.isActive === 1
        }
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal cek status pembayaran.' });
    }
  });

  /**
   * 4. POST /api/license/undangan-digital/validate-license
   */
  fastify.post('/api/license/undangan-digital/validate-license', async (request: FastifyRequest, reply: FastifyReply) => {
    const { license_key } = request.body as { license_key: string };
    if (!license_key) {
      return reply.status(400).send({ success: false, message: 'License key wajib diisi.' });
    }

    try {
      const license = await prisma.license.findUnique({
        where: { licenseKey: license_key.trim() },
        include: { plan: true }
      });

      if (!license || license.productId !== 'undangan-digital') {
        return reply.status(404).send({ success: false, message: 'Lisensi tidak valid.' });
      }

      const isPaid = license.isActive === 1 && license.status === 'active';
      return reply.send({
        success: true,
        data: {
          license_key: license.licenseKey,
          is_active: isPaid,
          plan_id: license.planId,
          plan_name: license.plan?.name,
          allow_print_kit: license.planId === 'UND-PLATINUM' || license.planId === 'UND-RESELLER',
          expires_at: license.expiresAt
        }
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal validasi lisensi.' });
    }
  });

  /**
   * 5. POST /api/license/undangan-digital/send-otp & POST /api/license/send-whatsapp
   * Mengirim pesan WhatsApp resmi (Kode OTP) untuk otentikasi Undangan Digital
   */
  const handleSendOtp = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { phone?: string; to?: string; number?: string; otp?: string; message?: string; text?: string };
    const phone = body.phone || body.to || body.number;
    const { otp } = body;
    const message = body.message || body.text;

    if (!phone) {
      return reply.status(400).send({ success: false, message: 'Nomor telepon WhatsApp wajib diisi.' });
    }

    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('62') ? cleanPhone : '62' + cleanPhone);

      let textToSend = message;
      if (!textToSend && otp) {
        const greetings = [
          'Halo Kak,',
          'Halo,',
          'Salam hangat,',
          'Hai Kak,'
        ];
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];

        const openings = [
          'Berikut adalah kode OTP verifikasi untuk masuk ke LuxeInvite Studio:',
          'Ini kode verifikasi keamanan untuk akun LuxeInvite Anda:',
          'Gunakan kode keamanan berikut untuk otentikasi login:',
          'Berikut kode otentikasi resmi untuk akses akun Anda:'
        ];
        const opening = openings[Math.floor(Math.random() * openings.length)];

        const warnings = [
          'Kode ini bersifat RAHASIA dan berlaku selama 5 menit. Mohon tidak membagikannya kepada siapa pun demi keamanan akun.',
          'Masa aktif kode 5 menit. Jangan bagikan kode ini kepada pihak lain termasuk staf.',
          'Berlaku selama 5 menit. Jaga selalu kerahasiaan kode keamanan Anda.'
        ];
        const warning = warnings[Math.floor(Math.random() * warnings.length)];

        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
        const refId = 'LX-' + Math.floor(1000 + Math.random() * 9000);

        textToSend = `*LuxeInvite Studio Verification*\n\n${greeting}\n${opening}\n\n🔐 *${otp}*\n\n${warning}\n\n_Ref: ${refId} • ${timeStr} WIB_`;
      } else if (!textToSend) {
        return reply.status(400).send({ success: false, message: 'Pesan atau kode OTP wajib disertakan.' });
      }

      await waGateway.sendMessage(formattedPhone, textToSend, 'OTP_UNDANGAN', 'undangan-digital');
      return reply.send({
        success: true,
        message: 'Kode OTP berhasil dikirim via WhatsApp Gateway.'
      });
    } catch (err: any) {
      console.error('[Undangan Digital WA OTP Error]', err.message);
      return reply.status(500).send({
        success: false,
        message: 'Gagal mengirim pesan via WhatsApp Gateway: ' + err.message
      });
    }
  };

  fastify.post('/api/license/undangan-digital/send-otp', handleSendOtp);
  fastify.post('/api/license/send-whatsapp', handleSendOtp);
  fastify.post('/api/wa/send', handleSendOtp);
};

