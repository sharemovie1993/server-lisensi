import { PrismaClient } from '@prisma/client';

function utcMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

export const revenueForecastService = {
  async calculateAndUpsertForecast(db: PrismaClient, targetMonth: Date, productId?: string) {
    const now = new Date();
    const month = utcMonthStart(targetMonth);

    const subWhere: any = { status: 'active' };
    if (productId && productId !== 'all') {
      subWhere.productId = productId === 'absenta' ? 'platform-absenta' : productId;
    }

    // Get active subscriptions
    const subs = await db.subscription.findMany({
      where: subWhere,
      include: {
        license: {
          include: {
            plan: true
          }
        }
      }
    });

    let totalMrr = 0;
    for (const sub of subs) {
      totalMrr += sub.license?.plan?.priceMonthly || 0;
    }

    // Get risks
    const risks = await db.platformRisk.findMany();
    let riskAdjustment = 0;
    for (const r of risks) {
      const sub = subs.find(s => s.licenseId === r.tenantId);
      const mrr = sub?.license?.plan?.priceMonthly || 0;
      if (r.riskLevel === 'HIGH_RISK') riskAdjustment += mrr * 0.3;
      if (r.riskLevel === 'CRITICAL') riskAdjustment += mrr * 0.6;
    }

    const projectedUpgradeGain = totalMrr * 0.05; // estimate 5% growth
    const projectedChurnLoss = totalMrr * 0.02; // estimate 2% churn

    const forecastMrr = totalMrr + projectedUpgradeGain - projectedChurnLoss;
    const forecastArr = forecastMrr * 12;
    const riskAdjustedForecast = forecastMrr - riskAdjustment;

    return {
      month,
      forecast_mrr: forecastMrr,
      forecast_arr: forecastArr,
      projected_churn_loss: projectedChurnLoss,
      projected_upgrade_gain: projectedUpgradeGain,
      projected_net_revenue: forecastMrr,
      risk_adjusted_forecast: riskAdjustedForecast,
      total_mrr: totalMrr,
      churn_rate: (projectedChurnLoss / (totalMrr || 1)) * 100,
      projected_mrr: forecastMrr,
      risk_adjustment: riskAdjustment,
      risk_score_snapshot: risks.length ? (risks.reduce((acc, r) => acc + r.riskScore, 0) / risks.length) : 0,
      calculated_at: now
    };
  },

  async getLatestForecast(db: PrismaClient, productId?: string) {
    const now = new Date();
    return this.calculateAndUpsertForecast(db, now, productId);
  },

  async lockMonthIfExists(_db: any, _month: Date): Promise<boolean> {
    return true;
  }
};
