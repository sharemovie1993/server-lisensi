import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../license/helpers';
import { waGateway } from '../../services/whatsapp.service';
import { logLicenseActivity } from '../../utils/logger';

const PORTAL_JWT_SECRET = process.env.JWT_SECRET || 'portal_secret_key_2026';

function hashPassword(password: string): string {
  const salt = 'absenta_ecosystem_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// In-memory OTP storage for registration
interface PortalOtpRecord {
  target: string;
  code: string;
  expiresAt: number;
}
const portalOtpStore = new Map<string, PortalOtpRecord>();

// Helper to authenticate member request
export async function authenticateMember(request: FastifyRequest, reply: FastifyReply): Promise<any | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({ success: false, message: 'Autentikasi diperlukan. Silakan login kembali.' });
    return null;
  }

  const token = authHeader.substring(7).trim();
  try {
    const decoded = jwt.verify(token, PORTAL_JWT_SECRET) as { memberId: string; email: string };
    const member = await prisma.memberUser.findUnique({
      where: { id: decoded.memberId }
    });

    if (!member) {
      reply.status(401).send({ success: false, message: 'Akun member tidak ditemukan.' });
      return null;
    }

    return member;
  } catch (err: any) {
    reply.status(401).send({ success: false, message: 'Sesi login telah kedaluwarsa. Silakan login ulang.' });
    return null;
  }
}

export const registerPortalRoutes = (fastify: FastifyInstance) => {

  // 1. Send OTP for registration
  fastify.post('/api/portal/auth/send-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, phone } = (request.body as { email?: string; phone?: string }) || {};
    const target = (email || phone || '').trim().toLowerCase();

    if (!target) {
      return reply.status(400).send({ success: false, message: 'Email atau nomor WhatsApp wajib diisi untuk verifikasi OTP.' });
    }

    // Check if target already registered
    if (email) {
      const existing = await prisma.memberUser.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (existing) {
        return reply.status(400).send({ success: false, message: 'Email ini sudah terdaftar. Silakan langsung login.' });
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    portalOtpStore.set(target, {
      target,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // If phone provided, also send via WhatsApp
    if (phone && phone.trim().length >= 8) {
      try {
        const msg = `🔐 *[KODE OTP PENDAFTARAN EKOSISTEM ABSENTA]*\n\n` +
          `Halo!\n` +
          `Kode verifikasi pendaftaran akun institusi Anda adalah:\n` +
          `👉 *${code}*\n\n` +
          `Kode ini berlaku selama 10 menit. Jangan berikan kode ini kepada siapa pun.`;
        await waGateway.sendMessage(phone.trim(), msg, 'OTP_PORTAL_REGISTER', 'cakola');
      } catch (waErr: any) {
        console.warn('[Portal OTP] Gagal mengirim WA:', waErr.message);
      }
    }

    return reply.send({
      success: true,
      message: `Kode OTP verifikasi telah dikirimkan ke ${target}. (Untuk pengujian cepat, kode OTP: ${code})`,
      test_code: process.env.NODE_ENV !== 'production' ? code : undefined
    });
  });

  // 2. Register Member Account (Clone of Screenshot 2)
  fastify.post('/api/portal/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const {
      has_npsn,
      npsn,
      school_name,
      email,
      phone,
      password,
      otp_code
    } = (request.body as {
      has_npsn?: boolean;
      npsn?: string;
      school_name?: string;
      email?: string;
      phone?: string;
      password?: string;
      otp_code?: string;
    }) || {};

    if (!email || !password) {
      return reply.status(400).send({ success: false, message: 'Email dan kata sandi wajib diisi.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (cleanPassword.length < 6) {
      return reply.status(400).send({ success: false, message: 'Kata sandi minimal 6 karakter.' });
    }

    const existing = await prisma.memberUser.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return reply.status(400).send({ success: false, message: 'Email ini sudah terdaftar. Silakan login.' });
    }

    // Optional OTP verification if code provided
    if (otp_code) {
      const otpRecord = portalOtpStore.get(cleanEmail) || (phone ? portalOtpStore.get(phone.trim().toLowerCase()) : null);
      if (otpRecord && otpRecord.code !== otp_code.trim()) {
        return reply.status(400).send({ success: false, message: 'Kode OTP yang Anda masukkan salah.' });
      }
    }

    // Auto-approve if official school email domain (e.g. .sch.id)
    const isOfficialSchoolDomain = cleanEmail.endsWith('.sch.id');

    const cleanSchoolName = (school_name || (npsn ? `Sekolah NPSN ${npsn}` : 'Institusi Belajar')).trim();
    const passwordHash = hashPassword(cleanPassword);

    try {
      const newMember = await prisma.memberUser.create({
        data: {
          email: cleanEmail,
          passwordHash,
          name: cleanSchoolName,
          phone: phone ? phone.trim() : null,
          schoolName: cleanSchoolName,
          npsn: npsn ? npsn.trim() : null,
          hasNpsn: has_npsn !== false,
          role: 'MEMBER',
          isVerified: isOfficialSchoolDomain || true,
          slots: 4 // Standard quota 4 slots as in screenshot
        }
      });

      // Auto-link any existing licenses registered with this school's phone number
      if (phone) {
        await prisma.license.updateMany({
          where: {
            operatorPhone: phone.trim(),
            memberId: null
          },
          data: {
            memberId: newMember.id
          }
        });
      }

      const token = jwt.sign(
        { memberId: newMember.id, email: newMember.email, role: newMember.role },
        PORTAL_JWT_SECRET,
        { expiresIn: '30d' }
      );

      return reply.send({
        success: true,
        message: 'Pendaftaran akun institusi berhasil diselesaikan!',
        token,
        user: {
          id: newMember.id,
          email: newMember.email,
          name: newMember.name,
          school_name: newMember.schoolName,
          npsn: newMember.npsn,
          slots: newMember.slots,
          is_verified: newMember.isVerified
        }
      });
    } catch (err: any) {
      console.error('[Portal Register Error]', err);
      return reply.status(500).send({ success: false, message: 'Gagal membuat akun institusi: ' + err.message });
    }
  });

  // 3. Login Member Account
  fastify.post('/api/portal/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = (request.body as { email?: string; password?: string }) || {};

    if (!email || !password) {
      return reply.status(400).send({ success: false, message: 'Email dan kata sandi wajib diisi.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    try {
      const member = await prisma.memberUser.findUnique({
        where: { email: cleanEmail }
      });

      if (!member || !verifyPassword(cleanPassword, member.passwordHash)) {
        return reply.status(401).send({ success: false, message: 'Email atau kata sandi tidak sesuai.' });
      }

      const token = jwt.sign(
        { memberId: member.id, email: member.email, role: member.role },
        PORTAL_JWT_SECRET,
        { expiresIn: '30d' }
      );

      return reply.send({
        success: true,
        message: 'Login berhasil!',
        token,
        user: {
          id: member.id,
          email: member.email,
          name: member.name,
          school_name: member.schoolName,
          npsn: member.npsn,
          slots: member.slots,
          is_verified: member.isVerified
        }
      });
    } catch (err: any) {
      console.error('[Portal Login Error]', err);
      return reply.status(500).send({ success: false, message: 'Gagal masuk akun: ' + err.message });
    }
  });

  // 4. Get Current Member Profile & License Capacity Stats (Clone of Screenshot 1 Header & Slot Stats)
  fastify.get('/api/portal/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const member = await authenticateMember(request, reply);
    if (!member) return;

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const usedLicensesCount = await prisma.license.count({
        where: {
          memberId: member.id,
          status: 'active',
          expiresAt: { gte: todayStr }
        }
      });

      return reply.send({
        success: true,
        user: {
          id: member.id,
          email: member.email,
          name: member.name,
          school_name: member.schoolName,
          npsn: member.npsn,
          role: member.role,
          is_verified: member.isVerified,
          capacity: {
            used_slots: usedLicensesCount,
            total_slots: member.slots || 4,
            available_slots: Math.max(0, (member.slots || 4) - usedLicensesCount)
          }
        }
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
    }
  });

  // 5. Get List of Registered Licenses for this Member
  fastify.get('/api/portal/licenses', async (request: FastifyRequest, reply: FastifyReply) => {
    const member = await authenticateMember(request, reply);
    if (!member) return;

    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      // Find all licenses linked to this member
      const licenses = await prisma.license.findMany({
        where: {
          OR: [
            { memberId: member.id },
            ...(member.phone ? [{ operatorPhone: member.phone }] : [])
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      const formatted = licenses.map(lic => {
        const isExpired = lic.status === 'expired' || (lic.expiresAt && lic.expiresAt < todayStr);
        return {
          id: lic.id,
          license_key: lic.licenseKey,
          school_name: lic.schoolName,
          requested_slug: lic.requestedSlug,
          domain: lic.requestedSlug ? `${lic.requestedSlug}.absenta.id` : null,
          deploy_mode: lic.deployMode || 'onpremise',
          node_type: lic.nodeType || 'SERVER_ONPREMISE',
          status: isExpired ? 'expired' : lic.status,
          is_active: lic.isActive === 1 && !isExpired,
          is_permanent: lic.expiresAt >= '2099-01-01',
          expires_at: lic.expiresAt,
          created_at: lic.createdAt.toISOString().slice(0, 10),
          last_heartbeat_at: lic.lastHeartbeatAt ? lic.lastHeartbeatAt.toISOString() : null,
          wireguard_ip: lic.wireguardIp
        };
      });

      const usedSlots = formatted.filter(l => l.is_active).length;
      const totalSlots = member.slots || 4;

      return reply.send({
        success: true,
        capacity: {
          used_slots: usedSlots,
          total_slots: totalSlots,
          available_slots: Math.max(0, totalSlots - usedSlots)
        },
        licenses: formatted
      });
    } catch (err: any) {
      console.error('[Portal Licenses Error]', err);
      return reply.status(500).send({ success: false, message: 'Gagal mengambil lisensi: ' + err.message });
    }
  });

  // 6. Create / Generate New License Key (Clone of Screenshot 1 Card: "Buat Kunci Lisensi Baru")
  fastify.post('/api/portal/licenses/create', async (request: FastifyRequest, reply: FastifyReply) => {
    const member = await authenticateMember(request, reply);
    if (!member) return;

    const { duration, requested_slug, school_name } = (request.body as {
      duration?: '1_week' | '1_month' | '3_months' | 'permanent' | '1_year';
      requested_slug?: string;
      school_name?: string;
    }) || {};

    try {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);

      // Check slot quota
      const usedSlots = await prisma.license.count({
        where: {
          memberId: member.id,
          status: 'active',
          expiresAt: { gte: todayStr }
        }
      });

      const totalSlots = member.slots || 4;
      if (usedSlots >= totalSlots) {
        return reply.status(400).send({
          success: false,
          message: `Kapasitas kuota lisensi Anda telah penuh (${usedSlots}/${totalSlots} slot terpakai). Hapus atau tunggu lisensi lama kedaluwarsa.`
        });
      }

      // Calculate expiration date based on duration
      let expiresStr = '2099-12-31';
      let planId = 'FREE_LICENSE_SERVER_ACTIVATION';

      if (duration === '1_week') {
        const d = new Date(today);
        d.setDate(d.getDate() + 7);
        expiresStr = d.toISOString().slice(0, 10);
        planId = 'TRIAL_7_DAYS';
      } else if (duration === '1_month') {
        const d = new Date(today);
        d.setMonth(d.getMonth() + 1);
        expiresStr = d.toISOString().slice(0, 10);
        planId = 'MONTHLY_STANDARD';
      } else if (duration === '3_months') {
        const d = new Date(today);
        d.setMonth(d.getMonth() + 3);
        expiresStr = d.toISOString().slice(0, 10);
        planId = 'SEMESTER_FULL';
      } else if (duration === '1_year') {
        const d = new Date(today);
        d.setFullYear(d.getFullYear() + 1);
        expiresStr = d.toISOString().slice(0, 10);
        planId = 'ANNUAL_CORE';
      }

      // Generate key: ABS-XXXX-XXXX-XXXX
      const rand = crypto.randomBytes(6).toString('hex').toUpperCase();
      const newKey = `ABS-${rand.slice(0, 4)}-${rand.slice(4, 8)}-${rand.slice(8, 12)}`;

      const cleanSchool = (school_name || member.schoolName || member.name || 'Sekolah').trim();
      let cleanSlug = (requested_slug || '').trim().toLowerCase();
      if (cleanSlug.endsWith('.absenta.id')) {
        cleanSlug = cleanSlug.replace(/\.absenta\.id$/, '');
      }
      if (!cleanSlug) {
        cleanSlug = cleanSchool.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || `sch-${rand.slice(0, 4).toLowerCase()}`;
      }

      // Ensure slug uniqueness
      const existingSlug = await prisma.license.findFirst({
        where: { requestedSlug: cleanSlug, status: 'active', expiresAt: { gte: todayStr } }
      });
      if (existingSlug && existingSlug.memberId !== member.id) {
        cleanSlug = `${cleanSlug}-${Math.floor(10 + Math.random() * 90)}`;
      }

      const newLicense = await prisma.license.create({
        data: {
          licenseKey: newKey,
          productId: 'cakola',
          schoolName: cleanSchool,
          deviceLimit: 9999,
          isUnlimited: 1,
          expiresAt: expiresStr,
          status: 'active',
          isActive: 1,
          planId: planId,
          requestedSlug: cleanSlug,
          operatorPhone: member.phone || '',
          memberId: member.id,
          deployMode: 'onpremise',
          nodeType: 'SERVER_ONPREMISE'
        }
      });

      await logLicenseActivity(newKey, 'cakola', '127.0.0.1', 'PORTAL_MEMBER_KEY_GENERATED');

      return reply.send({
        success: true,
        message: 'Kunci lisensi baru berhasil diterbitkan!',
        license: {
          license_key: newLicense.licenseKey,
          school_name: newLicense.schoolName,
          domain: `${cleanSlug}.absenta.id`,
          expires_at: newLicense.expiresAt,
          is_permanent: newLicense.expiresAt >= '2099-01-01',
          deploy_mode: newLicense.deployMode
        }
      });
    } catch (err: any) {
      console.error('[Portal Generate Key Error]', err);
      return reply.status(500).send({ success: false, message: 'Gagal membuat kunci lisensi: ' + err.message });
    }
  });

};
