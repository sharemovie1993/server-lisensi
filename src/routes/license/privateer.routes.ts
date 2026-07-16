import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { prisma, sendPrivateerTopUpNotification } from './helpers';

export const registerPrivateerLicenseRoutes = (fastify: FastifyInstance) => {

  /**
   * 1. Specialized endpoint for Privateer Top-up
   * Pattern: Parent License (School) -> Multiple Student Top-ups (Metadata in SchoolName)
   */
  fastify.post('/api/license/privateer/topup', async (request: FastifyRequest, reply: FastifyReply) => {
    const {
      student_name,
      student_id,
      class_id,
      class_name,
      plan_id,
      payment_method,
      wa_number,
      license_key // Parent license key
    } = request.body as any;

    if (!student_name || !plan_id || !license_key) {
      return reply.status(400).send({ success: false, message: 'Data top-up tidak lengkap.' });
    }

    try {
      // 1. Validate Parent License
      const parentLicense = await prisma.license.findUnique({
        where: { licenseKey: license_key.trim() }
      });
      if (!parentLicense) {
        return reply.status(404).send({ success: false, message: 'Lisensi platform tidak valid.' });
      }

      // 2. Get Plan
      const plan = await prisma.plan.findUnique({ where: { id: plan_id } });
      if (!plan) {
        return reply.status(404).send({ success: false, message: 'Paket top-up tidak ditemukan.' });
      }

      // 3. Setup Invoice & Tripay
      const randomPrefix = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-PVT-${randomPrefix}-${new Date().getFullYear()}`;
      const amount = plan.priceMonthly;

      const TRIPAY_API_KEY = process.env.TRIPAY_API_KEY || '';
      const TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY || '';
      const TRIPAY_MERCHANT_CODE = process.env.TRIPAY_MERCHANT_CODE || '';
      const TRIPAY_API_URL = process.env.TRIPAY_API_URL || 'https://tripay.co.id/api-sandbox';

      const signature = crypto
        .createHmac('sha256', TRIPAY_PRIVATE_KEY)
        .update(TRIPAY_MERCHANT_CODE + invoiceNumber + amount)
        .digest('hex');

      const tripayPayload = {
        method: payment_method || 'QRIS2',
        merchant_ref: invoiceNumber,
        amount: amount,
        customer_name: student_name,
        customer_email: 'billing@absenta.id',
        customer_phone: wa_number || '087779937341',
        order_items: [
          {
            sku: plan.id,
            name: `TOPUP: ${plan.name}`,
            price: amount,
            quantity: 1
          }
        ],
        expired_time: Math.floor(Date.now() / 1000) + 24 * 3600,
        signature
      };

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
      const tripayData = await response.json();

      if (!tripayData.success) {
        return reply.status(400).send({ success: false, message: tripayData.message });
      }

      const tx = tripayData.data;
      
      /**
       * Metadata Pattern for Privateer: "StudentName | StudentID | ClassID"
       * This is stored in schoolName to be parsed later during sync.
       */
      const metadata = `${student_name} | ${student_id} | ${class_id}`;

      // 4. Create Invoice
      await prisma.invoice.create({
        data: {
          invoiceNumber,
          licenseId: parentLicense.id,
          schoolName: metadata,
          productId: 'privateer',
          planTitle: plan.name,
          amount: tx.amount,
          status: 'unpaid',
          paymentMethod: payment_method || 'QRIS2',
          paymentInstructions: {
            instructions: tx.instructions || [],
            pay_code: tx.pay_code || '',
            qr_url: tx.qr_url || '',
            reference: tx.reference || ''
          },
          expiredTime: String(tx.expired_time),
          planId: plan.id
        }
      });

      // 5. Send Specialized Notification
      sendPrivateerTopUpNotification(
        wa_number,
        student_name,
        class_name || 'Kursus Privat',
        plan.name,
        invoiceNumber,
        tx.amount,
        payment_method || 'QRIS2',
        'unpaid',
        tx.pay_code,
        tx.qr_url
      ).catch((e: any) => console.error('[WA Privateer Notify Error]', e.message));

      return reply.send({
        success: true,
        data: {
          invoice_number: invoiceNumber,
          amount: tx.amount,
          payment_method: payment_method || 'QRIS2',
          payment_reference: tx.reference,
          qr_url: tx.qr_url || null,
          pay_code: tx.pay_code || null,
          payment_instructions: tx.instructions || [],
          expired_time: tx.expired_time
        }
      });

    } catch (err: any) {
      console.error('[Privateer Topup Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal memproses top-up Privateer.' });
    }
  });

  /**
   * 2. Get Paid Sessions for a Privateer License
   * Helps client backend to sync student session balances without manual string parsing.
   */
  fastify.get('/api/license/privateer/sessions/:licenseKey', async (request: FastifyRequest, reply: FastifyReply) => {
    const { licenseKey } = request.params as { licenseKey: string };
    
    try {
      const license = await prisma.license.findUnique({
        where: { licenseKey: licenseKey.trim() }
      });

      if (!license) {
        return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
      }

      // Find all PAID invoices for product 'privateer' under this license
      const invoices = await prisma.invoice.findMany({
        where: {
          licenseId: license.id,
          productId: 'privateer',
          status: 'paid'
        },
        orderBy: { paidAt: 'desc' }
      });

      const sessions = invoices.map(inv => {
        const metadata = inv.schoolName || '';
        const parts = metadata.split('|').map(p => p.trim());
        
        // Extract session count from planId (e.g. PVT_SESSION_10 -> 10)
        const sessionMatch = (inv.planId || '').match(/SESSION_(\d+)/);
        const count = sessionMatch ? parseInt(sessionMatch[1], 10) : 0;

        return {
          invoice_number: inv.invoiceNumber,
          student_name: parts[0] || 'Unknown',
          student_id: parts[1] || null,
          class_id: parts[2] || null,
          plan_id: inv.planId,
          session_count: count,
          paid_at: inv.paidAt,
          amount: inv.amount
        };
      });

      return reply.send({
        success: true,
        data: sessions
      });

    } catch (err: any) {
      console.error('[Privateer Sessions Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal mengambil data sesi Privateer.' });
    }
  });

  /**
   * 3. Check Student Session Balance by Phone Number
   * Called by client computer course application to verify student's active credits.
   */
  fastify.get('/api/license/privateer/balance/:phone', async (request: FastifyRequest, reply: FastifyReply) => {
    const { phone } = request.params as { phone: string };
    
    if (!phone) {
      return reply.status(400).send({ success: false, message: 'Nomor HP tidak valid.' });
    }

    try {
      const { formatWA } = require('./helpers');
      const cleanPhone = formatWA(phone);

      const userCredit = await prisma.userCredit.findUnique({
        where: { phone: cleanPhone }
      });

      if (!userCredit) {
        return reply.send({
          success: true,
          data: {
            phone: cleanPhone,
            balance: 0,
            studentName: 'Belum Terdaftar / Tidak Ada Saldo'
          }
        });
      }

      return reply.send({
        success: true,
        data: {
          phone: userCredit.phone,
          balance: userCredit.balance,
          studentName: userCredit.studentName || 'Siswa Privateer'
        }
      });

    } catch (err: any) {
      console.error('[Privateer Balance Check Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal memeriksa saldo sesi Privateer.' });
    }
  });

};
