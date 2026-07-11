import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  prisma,
  RequestBody,
  sendLicenseWhatsAppNotification,
  getProductPrefix,
  normalizeProductId
} from './helpers';
import { PRIVATE_KEY, PUBLIC_KEY } from '../../utils/keys';
import { logLicenseActivity } from '../../utils/logger';
import { waGateway } from '../../services/whatsapp.service';

export const registerCoreLicenseRoutes = (fastify: FastifyInstance) => {

  // 1. Request / renew license and billing setup
  fastify.post('/api/license/request', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as RequestBody;
    const {
      school_name,
      device_limit,
      is_unlimited,
      product_id,
      plan_id,
      payment_method,
      renew_license_key,
      requested_slug,
      include_vpn,
      device_id,
      phone_number,
      wa_number,
      whatsapp
    } = body;

    if (!school_name || !product_id || !plan_id) {
      return reply.status(400).send({ success: false, message: 'school_name, product_id, dan plan_id wajib diisi.' });
    }

    const rawProdId = product_id.trim();
    const prodId = normalizeProductId(rawProdId);
    const resolvedSchoolName = school_name.trim();
    const targetPhone = (phone_number || wa_number || whatsapp || (body as any).operator_phone || '').trim();

    // ── [SOFT] Validasi product_id ke DB ──────────────────────────────────
    // Soft enforcement: catat warning jika produk tidak dikenal, tapi tidak blokir
    // Upgrade ke hard reject setelah konfirmasi semua client sudah kirim product_id valid
    try {
      const productExists = await prisma.product.findUnique({ where: { id: prodId } });
      if (!productExists) {
        console.warn(`[LICENSE/REQUEST] ⚠️  SOFT-WARN: product_id '${prodId}' tidak ditemukan di DB. Client IP: ${request.ip}. Dilanjutkan dengan fallback.`);
        await logLicenseActivity('UNKNOWN', prodId, request.ip, 'REQUEST_UNKNOWN_PRODUCT_ID');
      }
    } catch (e: any) {
      console.warn(`[LICENSE/REQUEST] Gagal validasi product_id '${prodId}':`, e.message);
    }

    try {
      if (device_id) {
        const existingDeviceLicense = await prisma.license.findFirst({
          where: {
            originalDeviceId: device_id.trim(),
            productId: prodId
          }
        });
        if (existingDeviceLicense) {
          const invoice = await prisma.invoice.findFirst({
            where: { licenseId: existingDeviceLicense.id },
            orderBy: { createdAt: 'desc' }
          });
          return reply.send({
            success: true,
            message: 'Perangkat ini sudah terdaftar sebelumnya. Mengembalikan lisensi yang ada.',
            data: {
              license_key: existingDeviceLicense.licenseKey,
              invoice_number: invoice?.invoiceNumber || null,
              amount: invoice?.amount || 0,
              payment_method: invoice?.paymentMethod || 'Manual',
              payment_instructions: invoice?.paymentInstructions || null,
              expired_time: invoice ? Math.floor(new Date(invoice.createdAt).getTime() / 1000) + 48 * 3600 : null
            }
          });
        }
      }

      // Find the selected Plan
      const plan = await prisma.plan.findUnique({
        where: { id: plan_id }
      });
      if (!plan) {
        return reply.status(404).send({ success: false, message: 'Paket tidak ditemukan.' });
      }

      // ── [SOFT] Validasi plan_id cocok dengan product_id ───────────────────
      // Soft enforcement: catat warning jika plan bukan milik produk ini
      // Tidak blokir dulu — upgrade ke hard reject setelah audit client selesai
      if (plan.productId && normalizeProductId(plan.productId) !== prodId) {
        console.warn(
          `[LICENSE/REQUEST] ⚠️  SOFT-WARN: plan '${plan_id}' (productId: ${plan.productId}) ` +
          `tidak cocok dengan product_id yang diminta '${prodId}'. Client IP: ${request.ip}.`
        );
        await logLicenseActivity('UNKNOWN', prodId, request.ip, 'REQUEST_PLAN_PRODUCT_MISMATCH');
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

      const resolvedSlug = requested_slug ? requested_slug.trim().toLowerCase() : null;

      // Idempotency: If no license by renew key, check if there is a pending/inactive license with the same requested slug
      if (!existingLicense && resolvedSlug) {
        const matchingSlugLicense = await prisma.license.findFirst({
          where: { requestedSlug: resolvedSlug, productId: prodId }
        });
        if (matchingSlugLicense) {
          if (matchingSlugLicense.status === 'pending' || matchingSlugLicense.isActive === 0) {
            existingLicense = matchingSlugLicense;
          } else {
            return reply.status(400).send({
              success: false,
              message: `Subdomain / Slug '${resolvedSlug}' sudah digunakan oleh ${matchingSlugLicense.schoolName} dan masih aktif. Silakan gunakan subdomain yang berbeda.`
            });
          }
        }
      }

      const generateKey = (_prod: string, prefix: string) => {
        const rand = crypto.randomBytes(8).toString('hex').toUpperCase();
        return `${prefix}-${rand.slice(0, 4)}-${rand.slice(4, 8)}-${rand.slice(8, 12)}`;
      };

      // ── Ambil prefix dari DB Product secara dinamis via helper ─────────
      const productPrefix = await getProductPrefix(prodId);
      const newKey = existingLicense ? existingLicense.licenseKey : generateKey(prodId, productPrefix);

      // ──────── IDEMPOTENCY CHECK FOR UNPAID INVOICES ────────
      const resolvedPaymentMethod = payment_method || 'QRIS2';
      const nowUnix = Math.floor(Date.now() / 1000);
      
      if (existingLicense) {
        const existingPendingInvoice = await prisma.invoice.findFirst({
          where: {
            licenseId: existingLicense.id,
            productId: prodId,
            planId: plan_id,
            schoolName: resolvedSchoolName,
            status: 'unpaid',
            paymentMethod: resolvedPaymentMethod
          }
        });

        if (existingPendingInvoice) {
          const expTime = Number(existingPendingInvoice.expiredTime || 0);
          if (expTime > nowUnix) {
            let payInstructions: any[] = [];
            let payRef = '';
            let qrUrl = '';
            let payCode = '';
            
            if (existingPendingInvoice.paymentInstructions) {
              try {
                const parsed = typeof existingPendingInvoice.paymentInstructions === 'string'
                  ? JSON.parse(existingPendingInvoice.paymentInstructions)
                  : existingPendingInvoice.paymentInstructions;
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  payInstructions = parsed.instructions || [];
                  payRef = parsed.reference || '';
                  qrUrl = parsed.qr_url || '';
                  payCode = parsed.pay_code || '';
                } else if (Array.isArray(parsed)) {
                  payInstructions = parsed;
                  for (const instObj of parsed) {
                    if (instObj.steps && Array.isArray(instObj.steps)) {
                      for (const step of instObj.steps) {
                        const stepClean = String(step).toLowerCase();
                        if (stepClean.includes('virtual account') || stepClean.includes('va') || stepClean.includes('transfer') || stepClean.includes('bayar') || stepClean.includes('rekening')) {
                          const m = String(step).match(/\d{10,20}/);
                          if (m) {
                            payCode = m[0];
                            break;
                          }
                        }
                      }
                    }
                    if (payCode) break;
                  }
                }
              } catch {}
            }

            return reply.send({
              success: true,
              message: 'Invoice pending ditemukan (Idempotent).',
              data: {
                license_key: newKey,
                invoice_number: existingPendingInvoice.invoiceNumber,
                amount: existingPendingInvoice.amount,
                payment_method: existingPendingInvoice.paymentMethod,
                payment_reference: payRef,
                qr_url: qrUrl || null,
                pay_code: payCode || null,
                payment_instructions: payInstructions,
                expired_time: expTime
              }
            });
          }
        }
      }

      if (resolvedSlug && !existingLicense) {
        // Validate slug uniqueness locally (fallback check)
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
        } else {
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
              includeVpn: include_vpn || 0,
              originalDeviceId: device_id || null,
              operatorPhone: targetPhone || null
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

        if (targetPhone) {
          sendLicenseWhatsAppNotification(
            targetPhone,
            resolvedSchoolName,
            resolvedSlug,
            prodId,
            plan.name,
            newKey,
            invoiceNumber,
            0,
            'Gratis',
            'paid'
          ).catch(e => console.error('[WA Free License Notify Error]', e.message));
        }

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
      if (resolvedPaymentMethod === 'Manual' || resolvedPaymentMethod === 'manual') {
        let licenseId = '';
        if (existingLicense) {
          licenseId = existingLicense.id;
        } else {
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
              includeVpn: include_vpn || 0,
              originalDeviceId: device_id || null,
              operatorPhone: targetPhone || null
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

        if (targetPhone) {
          sendLicenseWhatsAppNotification(
            targetPhone,
            resolvedSchoolName,
            resolvedSlug,
            prodId,
            plan.name,
            newKey,
            invoiceNumber,
            basePrice,
            'Manual',
            'unpaid'
          ).catch(e => console.error('[WA Manual License Notify Error]', e.message));
        }

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
      const signature = crypto
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

      let tripayResponseData: any = null;
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
      } catch (err: any) {
        console.error('[Tripay API Net Error]', err.message);
      }

      if (tripayResponseData && tripayResponseData.success && tripayResponseData.data) {
        const tx = tripayResponseData.data;

        let licenseId = '';
        if (existingLicense) {
          licenseId = existingLicense.id;
        } else {
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
              includeVpn: include_vpn || 0,
              originalDeviceId: device_id || null,
              operatorPhone: targetPhone || null
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

        if (targetPhone) {
          sendLicenseWhatsAppNotification(
            targetPhone,
            resolvedSchoolName,
            resolvedSlug,
            prodId,
            plan.name,
            newKey,
            invoiceNumber,
            tx.amount || basePrice,
            resolvedPaymentMethod,
            'unpaid',
            tx.pay_code,
            tx.qr_url
          ).catch(e => console.error('[WA Tripay License Notify Error]', e.message));
        }

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
      } else {
        const errorMsg = tripayResponseData?.message || 'Gateway pembayaran Tripay sedang offline.';
        return reply.status(400).send({ success: false, message: errorMsg });
      }

    } catch (err: any) {
      console.error('[Request Billing Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal memproses request billing: ' + err.message });
    }
  });

  // 1b. Request local-free active license with automatic WhatsApp notification
  fastify.post('/api/license/request-local-free', async (request: FastifyRequest, reply: FastifyReply) => {
    const { school_name, wa_number, requested_slug } = request.body as {
      school_name: string;
      wa_number: string;
      requested_slug: string;
    };

    if (!school_name || !wa_number || !requested_slug) {
      return reply.status(400).send({ success: false, message: 'school_name, wa_number, dan requested_slug wajib diisi.' });
    }

    const cleanSlug = requested_slug.trim().toLowerCase();
    const cleanSchoolName = school_name.trim();
    const cleanWaNumber = wa_number.trim();

    // Local license key generator helper
    const generateLicenseKey = (prefix: string) => {
      const rand = crypto.randomBytes(8).toString('hex').toUpperCase();
      return `${prefix}-${rand.slice(0, 4)}-${rand.slice(4, 8)}-${rand.slice(8, 12)}`;
    };

    try {
      // 1. Validasi ketersediaan slug
      const existingLicense = await prisma.license.findFirst({
        where: { requestedSlug: cleanSlug },
        orderBy: { id: 'desc' }
      });

      if (existingLicense) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const isExpired = existingLicense.status === 'expired' || existingLicense.expiresAt < todayStr;
        
        if (!isExpired) {
          return reply.status(400).send({ 
            success: false, 
            message: `Subdomain '${cleanSlug}.absenta.id' sudah digunakan oleh sekolah lain dan masih aktif. Silakan pilih subdomain yang berbeda.` 
          });
        }
      }

      // 2. Generate license key untuk Platform Cakola (ABS)
      let productPrefix = 'ABS';
      try {
        const prod = await prisma.product.findUnique({
          where: { id: 'cakola' }
        });
        if (prod && prod.prefix) {
          productPrefix = prod.prefix;
        }
      } catch (e: any) {
        console.error('[Local Free License] Failed to fetch product prefix:', e.message);
      }

      const newKey = generateLicenseKey(productPrefix);
      const expiresStr = '2099-12-31';
      const planId = 'FREE_LICENSE_SERVER_ACTIVATION';

      // 3. Masukkan lisensi ke database
      const newLicense = await prisma.license.create({
        data: {
          licenseKey: newKey,
          productId: 'cakola',
          schoolName: cleanSchoolName,
          deviceLimit: 9999,
          isUnlimited: 1,
          expiresAt: expiresStr,
          status: 'active',
          isActive: 1,
          planId: planId,
          requestedSlug: cleanSlug,
          operatorPhone: cleanWaNumber
        }
      });

      // 4. Masukkan subscription ke database
      await prisma.subscription.create({
        data: {
          licenseId: newLicense.id,
          schoolName: cleanSchoolName,
          productId: 'cakola',
          planId: planId,
          status: 'active',
          startDate: new Date().toISOString().slice(0, 10),
          endDate: expiresStr
        }
      });

      // 5. Masukkan invoice ke database
      const randomPrefix = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-LOC-${randomPrefix}-${new Date().getFullYear()}`;
      await prisma.invoice.create({
        data: {
          invoiceNumber: invoiceNumber,
          licenseId: newLicense.id,
          schoolName: cleanSchoolName,
          productId: 'cakola',
          planTitle: 'Free Lisensi - Aktivasi Server',
          amount: 0,
          status: 'paid',
          paymentMethod: 'License Verification',
          paidAt: new Date(),
          planId: planId,
          expiredTime: (Math.floor(Date.now() / 1000) + 86400).toString()
        }
      });

      // 6. Kirim WhatsApp notifikasi via waGateway
      try {
        const waMessage = `🟢 *[AKTIVASI LISENSI LOKAL PLATFORM CAKOLA SUCCESS]*\n\n` +
          `Yth. Operator *${cleanSchoolName}*,\n` +
          `Selamat! Proses registrasi server dan pemasangan Platform Cakola untuk sekolah Anda telah berhasil diselesaikan secara sempurna.\n\n` +
          `Berikut adalah detail lisensi dan akses Anda:\n` +
          `🔑 Kunci Lisensi: \`${newKey}\`\n` +
          `🌐 Subdomain Akses Online: *https://${cleanSlug}.absenta.id*\n` +
          `📅 Status Lisensi: *AKTIF*\n\n` +
          `*Catatan Penting*:\n` +
          `- *Akses Online (Easy-Tunnel)*: Sudah aktif secara otomatis. Aplikasi dapat langsung diakses dari internet luar melalui tautan domain di atas.\n` +
          `- *Akses Lokal (Intranet)*: Dapat diakses menggunakan IP lokal server atau pengaturan Split DNS di jaringan internal sekolah.\n` +
          `- *Langkah Selanjutnya*: Buka tautan domain sekolah Anda di atas, lalu masuk menu *Daftar Sekolah / Registrasi Sekolah* untuk membuat akun Administrator utama sekolah Anda.\n\n` +
          `Simpan pesan ini sebagai bukti catatan lisensi Anda. Terima kasih!`;
        
        await waGateway.sendMessage(cleanWaNumber, waMessage);
        await logLicenseActivity(newKey, 'cakola', '127.0.0.1', 'WA_LOCAL_FREE_ACTIVATION_SENT');
      } catch (waErr: any) {
        console.error('[Local Free License] Gagal mengirim pesan WA:', waErr.message);
      }

      return reply.send({
        success: true,
        license_key: newKey,
        message: 'Registrasi lisensi lokal gratis berhasil.'
      });

    } catch (err: any) {
      console.error('[Local Free License Request Error]', err);
      return reply.status(500).send({ success: false, message: 'Gagal membuat lisensi lokal gratis: ' + err.message });
    }
  });

  // 2. SaaS provision status
  fastify.get('/api/license/provision-status/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
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

  // 3. Check license key status
  fastify.get('/api/license/check/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
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

      // ── Ambil featuresJson dari Plan ─────────────────────────────────
      let features: string[] = [];
      try {
        if (license.planId) {
          const plan = await prisma.plan.findUnique({ where: { id: license.planId } });
          features = (plan?.featuresJson as string[]) ?? [];
        }
      } catch (_) {}

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
          operator_phone: license.operatorPhone,
          npsn: (license as any).npsn,
          devices_count: devices.length,
          devices: mappedDevices,
          features                               // ← NEW: daftar fitur aktif dari plan
        }
      });
    } catch (err: any) {
      console.error(err);
      return reply.status(500).send({ success: false, message: 'Gagal memeriksa status lisensi.' });
    }
  });

  // 4. Get school active subscriptions list
  fastify.get('/api/license/my-subscriptions/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
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
    } catch (err: any) {
      console.error(err);
      return reply.status(500).send({ success: false, message: 'Gagal memuat daftar langganan sekolah.' });
    }
  });

  // 5. Get school active invoices list
  fastify.get('/api/license/my-invoices/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
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
    } catch (err: any) {
      console.error(err);
      return reply.status(500).send({ success: false, message: 'Gagal memuat riwayat invoice sekolah.' });
    }
  });

  // 6. Invoice status check
  fastify.get('/api/license/invoice-status/:invoiceNumber', async (request: FastifyRequest, reply: FastifyReply) => {
    const { invoiceNumber } = request.params as { invoiceNumber: string };
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
    } catch (err: any) {
      console.error('[Invoice Status Error]', err);
      return reply.status(500).send({ success: false, message: 'Gagal mengecek status invoice.' });
    }
  });

  // 7. Activate license manually with Direct Input (CLIENT APP)
  fastify.post('/api/license/activate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { license_key: string; device_id: string; product_id?: string };
    const { license_key, device_id, product_id } = body;

    if (!license_key || !device_id) {
      return reply.status(400).send({ success: false, message: 'Kunci lisensi (key) dan Device ID wajib diisi.' });
    }

    // ── [SOFT] product_id: default fallback dengan warning log ───────────
    // Soft enforcement: jika client tidak kirim product_id, fallback ke 'cakola'
    // dan catat warning agar kita bisa audit client mana yang belum update
    // Upgrade ke hard reject (return 400) setelah konfirmasi semua client aman
    if (!product_id) {
      console.warn(`[LICENSE/ACTIVATE] ⚠️  SOFT-WARN: product_id tidak dikirim. Fallback ke 'absenta'. license_key: ${license_key}, IP: ${request.ip}`);
      await logLicenseActivity(license_key || 'UNKNOWN', 'MISSING', request.ip, 'ACTIVATE_MISSING_PRODUCT_ID').catch(() => {});
    }
    const prodId = normalizeProductId(product_id || 'cakola');
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
        await logLicenseActivity(license_key, prodId, clientIp, 'ACTIVATE_FAILED_NOT_FOUND');
        return reply.status(404).send({ success: false, message: 'Kunci lisensi tidak ditemukan, kedaluwarsa, atau belum disetujui.' });
      }

      if (license.productId !== prodId) {
        await logLicenseActivity(license_key, prodId, clientIp, 'ACTIVATE_FAILED_PRODUCT_MISMATCH');
        return reply.status(400).send({
          success: false,
          message: `Lisensi ini diterbitkan untuk produk lain dan tidak dapat digunakan pada aplikasi ini.`
        });
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      if (license.expiresAt < todayStr) {
        await logLicenseActivity(license_key, prodId, clientIp, 'ACTIVATE_FAILED_EXPIRED');
        return reply.status(410).send({ success: false, message: 'Masa aktif lisensi ini sudah kedaluwarsa.' });
      }

      let vpnLicenseKey: string | null = null;
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
        } catch (vpnErr) {
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
        // ── Ambil featuresJson dari Plan yang terkait dengan lisensi ini ──
        let features: string[] = [];
        try {
          if (license.planId) {
            const plan = await prisma.plan.findUnique({ where: { id: license.planId } });
            features = (plan?.featuresJson as string[]) ?? [];
          }
        } catch (_) {}

        const token = jwt.sign(
          {
            license_key: license.licenseKey,
            product_id: license.productId,
            school_name: license.schoolName,
            device_id,
            expires_at: license.expiresAt,
            include_vpn: license.includeVpn,
            vpn_enabled: license.includeVpn,
            vpn_license_key: vpnLicenseKey,
            features                               // ← NEW: daftar fitur dari plan
          },
          PRIVATE_KEY,
          { algorithm: 'RS256', expiresIn: '365d' }
        );

        await logLicenseActivity(license_key, prodId, clientIp, 'ACTIVATE_RESTORED');

        return reply.send({
          success: true,
          message: 'Perangkat ini sudah terdaftar sebelumnya. Aktivasi dipulihkan.',
          token,
          school_name: license.schoolName,
          expires_at: license.expiresAt,
          include_vpn: license.includeVpn,
          vpn_license_key: vpnLicenseKey,
          features                                 // ← NEW: juga di response langsung
        });
      }

      const activeCount = await prisma.activatedDevice.count({
        where: { licenseId: license.id }
      });

      if (license.isUnlimited !== 1 && activeCount >= license.deviceLimit) {
        await logLicenseActivity(license_key, prodId, clientIp, 'ACTIVATE_FAILED_LIMIT_REACHED');
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

      // ── Ambil featuresJson dari Plan untuk token payload ────────────────
      let features: string[] = [];
      try {
        if (license.planId) {
          const plan = await prisma.plan.findUnique({ where: { id: license.planId } });
          features = (plan?.featuresJson as string[]) ?? [];
        }
      } catch (_) {}

      const token = jwt.sign(
        {
          license_key: license.licenseKey,
          product_id: license.productId,
          school_name: license.schoolName,
          device_id,
          expires_at: license.expiresAt,
          include_vpn: license.includeVpn,
          vpn_enabled: license.includeVpn,
          vpn_license_key: vpnLicenseKey,
          features                               // ← NEW: daftar fitur dari plan
        },
        PRIVATE_KEY,
        { algorithm: 'RS256', expiresIn: '365d' }
      );

      await logLicenseActivity(license_key, prodId, clientIp, 'ACTIVATE_SUCCESS');

      return reply.send({
        success: true,
        message: 'Aktivasi lisensi berhasil dipublikasikan untuk perangkat ini.',
        token,
        school_name: license.schoolName,
        expires_at: license.expiresAt,
        include_vpn: license.includeVpn,
        vpn_license_key: vpnLicenseKey,
        features                                 // ← NEW: juga di response langsung
      });

    } catch (err) {
      console.error(err);
      return reply.status(500).send({ success: false, message: 'Terjadi kesalahan sistem saat memproses aktivasi.' });
    }
  });

  // 7.5 Release/Reset active device locks for a license (CLIENT APP RESET)
  fastify.post('/api/license/release', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { license_key: string; device_id?: string };
    const { license_key, device_id } = body;

    if (!license_key) {
      return reply.status(400).send({ success: false, message: 'Kunci lisensi (license_key) wajib diisi.' });
    }

    try {
      const license = await prisma.license.findUnique({
        where: { licenseKey: license_key.trim() }
      });

      if (!license) {
        return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
      }

      if (device_id) {
        // Delete specific device registration
        await prisma.activatedDevice.deleteMany({
          where: {
            licenseId: license.id,
            deviceId: device_id.trim()
          }
        });
      } else {
        // Reset all activated devices for this license
        await prisma.activatedDevice.deleteMany({
          where: { licenseId: license.id }
        });
      }

      // Also reset telemetry fields in the license
      await prisma.license.update({
        where: { id: license.id },
        data: {
          activeHostname: null,
          activeOs: null,
          originalDeviceId: null
        }
      });

      console.log(`[License Release] Reset devices/hosts lock for license: ${license_key}`);

      return reply.send({
        success: true,
        message: 'Kunci perangkat (device lock) berhasil dilepas.'
      });
    } catch (err: any) {
      console.error('[License Release Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal melepas kunci perangkat: ' + err.message });
    }
  });

  // 8. Verify license JWT (CLIENT APP BACKGROUND CHECK)
  fastify.post('/api/license/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.body as { token: string };

    if (!token) {
      return reply.status(400).send({ success: false, message: 'Token verifikasi tidak ditemukan.' });
    }

    const clientIp = request.ip;

    try {
      const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] }) as any;

      const license = await prisma.license.findFirst({
        where: {
          licenseKey: decoded.license_key,
          isActive: 1,
          status: 'active'
        }
      });

      if (!license) {
        await logLicenseActivity(decoded.license_key, decoded.product_id, clientIp, 'VERIFY_FAILED_REVOKED');
        return reply.status(401).send({ success: false, message: 'Lisensi dibatalkan atau dinonaktifkan oleh administrator.' });
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      if (license.expiresAt < todayStr) {
        await logLicenseActivity(decoded.license_key, decoded.product_id, clientIp, 'VERIFY_FAILED_EXPIRED');
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
        await logLicenseActivity(decoded.license_key, decoded.product_id, clientIp, 'VERIFY_FAILED_DEVICE_UNAUTHORIZED');
        return reply.status(401).send({ success: false, message: 'Perangkat ini dide-otorisasi dari lisensi.' });
      }

      await logLicenseActivity(decoded.license_key, decoded.product_id, clientIp, 'VERIFY_ONLINE_SUCCESS');

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

    } catch (err) {
      return reply.status(401).send({ success: false, message: 'Sesi lisensi kedaluwarsa atau tidak valid.' });
    }
  });

  // 9. Public Key check
  fastify.get('/api/license/public-key', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true, public_key: PUBLIC_KEY });
  });

  // 10. System Config
  fastify.get('/api/license/system-config', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const list = await prisma.systemSetting.findMany();
      const settings: any = {};
      list.forEach(row => {
        settings[row.key] = row.value;
      });
      return reply.send({ success: true, data: settings });
    } catch (err: any) {
      console.error(err);
      return reply.status(500).send({ success: false, message: 'Gagal memuat konfigurasi sistem pembayaran.' });
    }
  });

  // 11. Update Academic Tier for existing school license
  fastify.post('/api/license/update-academic-tier', async (request: FastifyRequest, reply: FastifyReply) => {
    const { license_key, tier } = request.body as { license_key: string; tier: string };

    if (!license_key || !tier) {
      return reply.status(400).send({ success: false, message: 'license_key dan tier wajib diisi.' });
    }

    const tierUpper = tier.trim().toUpperCase();
    if (!['MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'].includes(tierUpper)) {
      return reply.status(400).send({ success: false, message: 'Tier tidak valid. Gunakan: MICRO, SMALL, MEDIUM, LARGE, atau ENTERPRISE.' });
    }

    try {
      const license = await prisma.license.findUnique({
        where: { licenseKey: license_key.trim() }
      });

      if (!license) {
        return reply.status(404).send({ success: false, message: 'Lisensi tidak ditemukan.' });
      }

      const targetPlanId = `ACADEMIC_${tierUpper}_TAHUNAN`;
      const plan = await prisma.plan.findUnique({
        where: { id: targetPlanId }
      });

      if (!plan) {
        return reply.status(404).send({ success: false, message: `Academic plan ${targetPlanId} tidak ditemukan di server lisensi.` });
      }

      // Deactivate any other CORE subscriptions for this license key
      const corePlans = await prisma.plan.findMany({
        where: { serviceCode: 'CORE' },
        select: { id: true }
      });
      const corePlanIds = corePlans.map(p => p.id);

      const coreSubs = await prisma.subscription.findMany({
        where: {
          licenseId: license.id,
          planId: { in: corePlanIds }
        }
      });

      for (const sub of coreSubs) {
        await prisma.subscription.delete({
          where: { id: sub.id }
        });
      }

      // Create new active CORE subscription
      const nowStr = new Date().toISOString().slice(0, 10);
      const end = new Date();
      end.setFullYear(end.getFullYear() + 100);
      const endStr = end.toISOString().slice(0, 10);

      const newSub = await prisma.subscription.create({
        data: {
          licenseId: license.id,
          schoolName: license.schoolName,
          productId: license.productId,
          planId: plan.id,
          status: 'active',
          startDate: nowStr,
          endDate: endStr
        }
      });

      console.log(`[Licensing Server] Successfully updated academic tier to ${tierUpper} for license: ${license_key}`);

      return reply.send({
        success: true,
        message: `Kapasitas sekolah berhasil diubah ke ${tierUpper}.`,
        subscription: {
          id: newSub.id,
          plan_id: newSub.planId,
          status: newSub.status,
          start_date: newSub.startDate,
          end_date: newSub.endDate
        }
      });
    } catch (err: any) {
      console.error('[Update Academic Tier Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal memperbarui kapasitas sekolah: ' + err.message });
    }
  });

  // 12. Update school name and NPSN for an existing license
  fastify.post('/api/license/update-info', async (request: FastifyRequest, reply: FastifyReply) => {
    const { license_key, school_name, npsn } = request.body as {
      license_key: string;
      school_name?: string;
      npsn?: string;
    };

    if (!license_key) {
      return reply.status(400).send({ success: false, message: 'license_key wajib disertakan.' });
    }

    try {
      const license = await prisma.license.findUnique({
        where: { licenseKey: license_key.trim() }
      });

      if (!license) {
        return reply.status(404).send({ success: false, message: 'Kunci lisensi tidak ditemukan.' });
      }

      const updateData: any = {};
      if (school_name !== undefined) {
        updateData.schoolName = school_name.trim();
      }
      if (npsn !== undefined) {
        updateData.npsn = npsn.trim();
      }

      if (Object.keys(updateData).length === 0) {
        return reply.status(400).send({ success: false, message: 'Tidak ada data yang diperbarui.' });
      }

      await prisma.license.update({
        where: { id: license.id },
        data: updateData
      });

      console.log(`[Licensing Server] Successfully updated info for license: ${license_key}`, updateData);

      return reply.send({
        success: true,
        message: 'Informasi lisensi berhasil diperbarui.'
      });
    } catch (err: any) {
      console.error('[Update License Info Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal memperbarui info lisensi: ' + err.message });
    }
  });

  // 13. Send registration WhatsApp credentials notification
  fastify.post('/api/license/tenant-registered-wa', async (request: FastifyRequest, reply: FastifyReply) => {
    const { school_name, subdomain, admin_email, admin_password, admin_phone } = request.body as {
      school_name: string;
      subdomain: string;
      admin_email: string;
      admin_password: string;
      admin_phone: string;
    };

    if (!school_name || !subdomain || !admin_email || !admin_password || !admin_phone) {
      return reply.status(400).send({ success: false, message: 'school_name, subdomain, admin_email, admin_password, dan admin_phone wajib diisi.' });
    }

    try {
      const cleanSchoolName = school_name.trim();
      const cleanSubdomain = subdomain.trim().toLowerCase();
      const pesan = `*Registrasi Absenta Berhasil!* 🚀\n\nHalo, sekolah Anda *${cleanSchoolName}* telah berhasil terdaftar pada sistem Absenta.\n\nBerikut adalah detail akun Administrator Anda:\n- *Subdomain:* ${cleanSubdomain}.absenta.id\n- *Email:* ${admin_email}\n- *Password:* ${admin_password}\n\nMohon simpan informasi ini baik-baik dan jangan dibagikan kepada pihak lain.`;

      let sent = false;
      try {
        sent = await waGateway.sendMessage(admin_phone.trim(), pesan);
      } catch (err: any) {
        console.error('[WA Send Registrasi Error]', err.message);
      }

      if (sent) {
        return reply.send({ success: true, message: 'WhatsApp notifikasi berhasil dikirim.' });
      } else {
        return reply.status(500).send({ success: false, message: 'Gagal mengirim pesan WhatsApp. Pastikan nomor WhatsApp aktif atau gateway terhubung.' });
      }
    } catch (err: any) {
      console.error('[Tenant Registered WA Error]', err.message);
      return reply.status(500).send({ success: false, message: 'Gagal memproses WA notifikasi: ' + err.message });
    }
  });

};
