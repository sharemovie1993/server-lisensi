import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './license/helpers';
import { verifyAdmin } from './admin/middleware';

export const skkniRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // =========================================================================
  // 1. PUBLIC / CLIENT ABSENTA FETCH ENDPOINTS
  // Di-hit oleh berbagai server sekolah lokal Absenta untuk mengadopsi unit SKKNI
  // =========================================================================

  /**
   * GET /api/skkni/katalog
   * Mengambil daftar master katalog SKKNI beserta daftar unit kompetensi
   * Query params:
   *  - search: string (pencarian nama skema, kode, judul unit)
   *  - rumpun: string (filter kategori rumpun kejuruan)
   *  - include_units: boolean ('true' / 'false', default: true)
   */
  fastify.get('/api/skkni/katalog', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { search, rumpun, include_units = 'true' } = request.query as {
        search?: string;
        rumpun?: string;
        include_units?: string;
      };

      const where: any = { isActive: true };

      if (rumpun && rumpun !== 'ALL') {
        where.rumpun = rumpun;
      }

      if (search && search.trim().length > 0) {
        const q = search.trim();
        where.OR = [
          { namaSkema: { contains: q, mode: 'insensitive' } },
          { kodeSkema: { contains: q, mode: 'insensitive' } },
          { rumpun: { contains: q, mode: 'insensitive' } },
          { deskripsi: { contains: q, mode: 'insensitive' } },
          {
            units: {
              some: {
                OR: [
                  { kodeUnit: { contains: q, mode: 'insensitive' } },
                  { judulUnitId: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        ];
      }

      const shouldIncludeUnits = include_units === 'true' || include_units === true as any;

      const list = await prisma.skkniKatalog.findMany({
        where,
        include: shouldIncludeUnits
          ? {
              units: {
                orderBy: { urutan: 'asc' },
              },
            }
          : undefined,
        orderBy: [{ rumpun: 'asc' }, { namaSkema: 'asc' }],
      });

      return reply.send({
        success: true,
        message: 'Katalog SKKNI berhasil dimuat',
        total: list.length,
        data: list,
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        success: false,
        message: 'Gagal memuat katalog SKKNI dari Server Lisensi.',
        error: err.message,
      });
    }
  });

  /**
   * GET /api/skkni/katalog/:id
   * Detail satu skema katalog beserta unit kompetensi lengkap
   */
  fastify.get('/api/skkni/katalog/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const katalog = await prisma.skkniKatalog.findFirst({
        where: {
          OR: [{ id }, { kodeSkema: id }],
        },
        include: {
          units: {
            orderBy: { urutan: 'asc' },
          },
        },
      });

      if (!katalog) {
        return reply.status(404).send({
          success: false,
          message: 'Skema SKKNI tidak ditemukan',
        });
      }

      return reply.send({
        success: true,
        data: katalog,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: 'Gagal memuat detail skema SKKNI.',
        error: err.message,
      });
    }
  });

  /**
   * GET /api/skkni/rumpun
   * Mengambil daftar seluruh nama rumpun kejuruan unik yang tersedia
   */
  fastify.get('/api/skkni/rumpun', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const distinctRumpun = await prisma.skkniKatalog.findMany({
        where: { isActive: true },
        select: { rumpun: true },
        distinct: ['rumpun'],
        orderBy: { rumpun: 'asc' },
      });

      const list = distinctRumpun.map((r) => r.rumpun);
      return reply.send({
        success: true,
        data: list,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: 'Gagal memuat kategori rumpun SKKNI.',
        error: err.message,
      });
    }
  });

  // =========================================================================
  // 2. ADMIN CRUD ENDPOINTS (HQ Management via Platform Panel)
  // =========================================================================

  /**
   * POST /api/admin/skkni/katalog
   * Buat skema baru beserta daftar unit awal
   */
  fastify.post('/api/admin/skkni/katalog', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const body = request.body as {
        rumpun: string;
        kodeSkema: string;
        namaSkema: string;
        namaSkemaEn?: string;
        levelKkni?: number;
        deskripsi?: string;
        defaultJudulId?: string;
        defaultJudulEn?: string;
        units?: Array<{
          kodeUnit: string;
          judulUnitId: string;
          judulUnitEn?: string;
          kategori?: string;
        }>;
      };

      if (!body.rumpun || !body.kodeSkema || !body.namaSkema) {
        return reply.status(400).send({
          success: false,
          message: 'rumpun, kodeSkema, dan namaSkema wajib diisi',
        });
      }

      const created = await prisma.skkniKatalog.create({
        data: {
          rumpun: body.rumpun,
          kodeSkema: body.kodeSkema.trim().toUpperCase(),
          namaSkema: body.namaSkema.trim(),
          namaSkemaEn: body.namaSkemaEn?.trim() || null,
          levelKkni: Number(body.levelKkni) || 2,
          deskripsi: body.deskripsi || null,
          defaultJudulId: body.defaultJudulId || null,
          defaultJudulEn: body.defaultJudulEn || null,
          units: Array.isArray(body.units) && body.units.length > 0
            ? {
                create: body.units.map((u, idx) => ({
                  kodeUnit: u.kodeUnit.trim(),
                  judulUnitId: u.judulUnitId.trim(),
                  judulUnitEn: u.judulUnitEn?.trim() || null,
                  kategori: u.kategori || 'INTI',
                  urutan: idx + 1,
                })),
              }
            : undefined,
        },
        include: { units: true },
      });

      return reply.status(201).send({
        success: true,
        message: 'Skema SKKNI baru berhasil didaftarkan',
        data: created,
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({
          success: false,
          message: 'Kode skema sudah pernah terdaftar. Gunakan kode lain.',
        });
      }
      return reply.status(500).send({
        success: false,
        message: 'Gagal membuat skema SKKNI baru.',
        error: err.message,
      });
    }
  });

  /**
   * PUT /api/admin/skkni/katalog/:id
   * Update metadata skema SKKNI
   */
  fastify.put('/api/admin/skkni/katalog/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;

      const updated = await prisma.skkniKatalog.update({
        where: { id },
        data: {
          ...(body.rumpun ? { rumpun: body.rumpun } : {}),
          ...(body.kodeSkema ? { kodeSkema: body.kodeSkema.trim().toUpperCase() } : {}),
          ...(body.namaSkema ? { namaSkema: body.namaSkema.trim() } : {}),
          ...(body.namaSkemaEn !== undefined ? { namaSkemaEn: body.namaSkemaEn?.trim() || null } : {}),
          ...(body.levelKkni !== undefined ? { levelKkni: Number(body.levelKkni) } : {}),
          ...(body.deskripsi !== undefined ? { deskripsi: body.deskripsi } : {}),
          ...(body.defaultJudulId !== undefined ? { defaultJudulId: body.defaultJudulId } : {}),
          ...(body.defaultJudulEn !== undefined ? { defaultJudulEn: body.defaultJudulEn } : {}),
          ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        },
        include: { units: { orderBy: { urutan: 'asc' } } },
      });

      return reply.send({
        success: true,
        message: 'Skema SKKNI berhasil diperbarui',
        data: updated,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: 'Gagal memperbarui skema SKKNI.',
        error: err.message,
      });
    }
  });

  /**
   * DELETE /api/admin/skkni/katalog/:id
   * Hapus skema SKKNI (cascade menghapus seluruh unit di dalamnya)
   */
  fastify.delete('/api/admin/skkni/katalog/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const { id } = request.params as { id: string };
      await prisma.skkniKatalog.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'Skema SKKNI dan seluruh unitnya berhasil dihapus',
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: 'Gagal menghapus skema SKKNI.',
        error: err.message,
      });
    }
  });

  /**
   * POST /api/admin/skkni/katalog/:id/units
   * Menambahkan unit kompetensi ke dalam skema tertentu
   */
  fastify.post('/api/admin/skkni/katalog/:id/units', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        kodeUnit: string;
        judulUnitId: string;
        judulUnitEn?: string;
        kategori?: string;
        urutan?: number;
      };

      if (!body.kodeUnit || !body.judulUnitId) {
        return reply.status(400).send({
          success: false,
          message: 'kodeUnit dan judulUnitId wajib diisi',
        });
      }

      // Hitung urutan terakhir jika tidak disediakan
      let urutan = body.urutan;
      if (!urutan) {
        const last = await prisma.skkniUnit.findFirst({
          where: { katalogId: id },
          orderBy: { urutan: 'desc' },
        });
        urutan = (last?.urutan || 0) + 1;
      }

      const unit = await prisma.skkniUnit.create({
        data: {
          katalogId: id,
          kodeUnit: body.kodeUnit.trim(),
          judulUnitId: body.judulUnitId.trim(),
          judulUnitEn: body.judulUnitEn?.trim() || null,
          kategori: body.kategori || 'INTI',
          urutan,
        },
      });

      return reply.status(201).send({
        success: true,
        message: 'Unit kompetensi berhasil ditambahkan',
        data: unit,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: 'Gagal menambahkan unit kompetensi.',
        error: err.message,
      });
    }
  });

  /**
   * PUT /api/admin/skkni/units/:unitId
   * Update unit kompetensi
   */
  fastify.put('/api/admin/skkni/units/:unitId', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const { unitId } = request.params as { unitId: string };
      const body = request.body as any;

      const updated = await prisma.skkniUnit.update({
        where: { id: unitId },
        data: {
          ...(body.kodeUnit ? { kodeUnit: body.kodeUnit.trim() } : {}),
          ...(body.judulUnitId ? { judulUnitId: body.judulUnitId.trim() } : {}),
          ...(body.judulUnitEn !== undefined ? { judulUnitEn: body.judulUnitEn?.trim() || null } : {}),
          ...(body.kategori ? { kategori: body.kategori } : {}),
          ...(body.urutan !== undefined ? { urutan: Number(body.urutan) } : {}),
        },
      });

      return reply.send({
        success: true,
        message: 'Unit kompetensi berhasil diperbarui',
        data: updated,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: 'Gagal memperbarui unit kompetensi.',
        error: err.message,
      });
    }
  });

  /**
   * DELETE /api/admin/skkni/units/:unitId
   * Hapus unit kompetensi
   */
  fastify.delete('/api/admin/skkni/units/:unitId', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      const { unitId } = request.params as { unitId: string };
      await prisma.skkniUnit.delete({
        where: { id: unitId },
      });

      return reply.send({
        success: true,
        message: 'Unit kompetensi berhasil dihapus',
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: 'Gagal menghapus unit kompetensi.',
        error: err.message,
      });
    }
  });
};
