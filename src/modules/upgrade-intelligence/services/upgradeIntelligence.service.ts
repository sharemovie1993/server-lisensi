import { PrismaClient } from '@prisma/client';

async function resolveSchoolNameFromSlug(db: PrismaClient, slug: string): Promise<string> {
  const activeSub = await db.subscription.findFirst({
    where: {
      schoolName: { contains: `|${slug}` }
    },
    select: { schoolName: true }
  });
  if (activeSub) {
    return activeSub.schoolName.split('|')[0].trim();
  }

  const lic = await db.license.findFirst({
    where: {
      OR: [
        { requestedSlug: slug },
        { customDomain: slug },
        { id: slug }
      ]
    },
    select: { schoolName: true }
  });
  if (lic) {
    return lic.schoolName;
  }

  return 'Unknown';
}

export const upgradeIntelligenceService = {
  normalizeMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  },

  monthKeyUtc(date: Date): string {
    return this.normalizeMonth(date).toISOString().slice(0, 7);
  },

  async getOverview(db: PrismaClient, _lastNMonths = 12) {
    const list = await db.upgradeIntelligence.findMany({
      orderBy: { intentScore: 'desc' },
      take: 20
    });

    const topHotTenants = [];
    for (const t of list.slice(0, 10)) {
      const tenantName = await resolveSchoolNameFromSlug(db, t.tenantId);
      topHotTenants.push({
        tenant_id: t.tenantId,
        tenant_name: tenantName,
        intent_score: t.intentScore,
        intent_level: t.intentLevel,
        usage_growth_percent: t.usageGrowthPercent,
        last_calculated_at: t.lastCalculatedAt
      });
    }

    const distribution = {
      LOW: list.filter(x => x.intentLevel === 'LOW').length,
      MEDIUM: list.filter(x => x.intentLevel === 'MEDIUM').length,
      HIGH: list.filter(x => x.intentLevel === 'HIGH').length,
    };

    return {
      latest_month: this.monthKeyUtc(new Date()),
      funnels: [
        {
          month: this.monthKeyUtc(new Date()),
          intent_count: list.filter(x => x.intentScore >= 70).length,
          invoice_created_count: 0,
          invoice_paid_count: 0,
          upgrade_applied_count: 0,
          conversion_rate: 0
        }
      ],
      intent_distribution: Object.entries(distribution).map(([level, count]) => ({
        intent_level: level,
        _count: { _all: count }
      })),
      top_hot_tenants: topHotTenants
    };
  },

  async getMonthSnapshot(db: PrismaClient, _month: string) {
    return this.getOverview(db);
  },

  async getTenantMonth(db: PrismaClient, tenantId: string, _month: string) {
    const record = await db.upgradeIntelligence.findUnique({
      where: { tenantId }
    });
    if (!record) return null;

    const tenantName = await resolveSchoolNameFromSlug(db, tenantId);

    return {
      tenant_id: record.tenantId,
      tenant_name: tenantName,
      intent_score: record.intentScore,
      intent_level: record.intentLevel,
      usage_growth_percent: record.usageGrowthPercent,
      last_calculated_at: record.lastCalculatedAt
    };
  }
};
