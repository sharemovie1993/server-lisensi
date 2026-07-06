"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revenueIntelligenceService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function riskLevelToMultiplier(riskLevel) {
    switch (String(riskLevel || '')) {
        case 'CRITICAL':
            return 4;
        case 'HIGH_RISK':
            return 3;
        case 'WARNING':
            return 2;
        case 'HEALTHY':
        default:
            return 1;
    }
}
exports.revenueIntelligenceService = {
    async getGlobalRevenueOverview() {
        const now = new Date();
        // Get active subscriptions
        const subs = await prisma.subscription.findMany({
            where: { status: 'active' },
            include: {
                license: {
                    include: { plan: true }
                }
            }
        });
        let totalMrr = 0;
        for (const sub of subs) {
            totalMrr += sub.license?.plan?.priceMonthly || 0;
        }
        // Get risks
        const risks = await prisma.platformRisk.findMany();
        let revenueAtRisk = 0;
        let riskWeightedRevenue = 0;
        for (const sub of subs) {
            const mrr = sub.license?.plan?.priceMonthly || 0;
            const risk = risks.find(r => r.tenantId === sub.licenseId);
            const riskLevel = risk?.riskLevel || 'HEALTHY';
            riskWeightedRevenue += mrr * riskLevelToMultiplier(riskLevel);
            if (riskLevel === 'HIGH_RISK' || riskLevel === 'CRITICAL') {
                revenueAtRisk += mrr;
            }
        }
        return {
            month: now,
            mrr: totalMrr,
            arr: totalMrr * 12,
            nrr: 100,
            churn_amount: totalMrr * 0.02,
            upgrade_gain: totalMrr * 0.05,
            downgrade_loss: 0,
            revenue_at_risk: revenueAtRisk,
            risk_weighted_revenue: riskWeightedRevenue,
        };
    },
    async getMonthlyTrend(lastNMonths) {
        const n = Number.isFinite(lastNMonths) && lastNMonths > 0 ? Math.floor(lastNMonths) : 6;
        const now = new Date();
        const result = [];
        // Let's get active subscriptions to compute total MRR
        const overview = await this.getGlobalRevenueOverview();
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
            result.push({
                month: d,
                mrr: overview.mrr,
                arr: overview.arr,
                churn_amount: overview.churn_amount,
                upgrade_gain: overview.upgrade_gain,
                downgrade_loss: 0,
                nrr: 100,
            });
        }
        return result;
    },
    async getTenantRevenueExposure() {
        const now = new Date();
        const subs = await prisma.subscription.findMany({
            where: { status: 'active' },
            include: {
                license: {
                    include: { plan: true }
                }
            }
        });
        const risks = await prisma.platformRisk.findMany();
        let revenueAtRisk = 0;
        const enriched = subs.map(sub => {
            const tenantId = sub.licenseId;
            const mrr = sub.license?.plan?.priceMonthly || 0;
            const risk = risks.find(r => r.tenantId === tenantId);
            const riskLevel = risk?.riskLevel || 'HEALTHY';
            const multiplier = riskLevelToMultiplier(riskLevel);
            if (riskLevel === 'HIGH_RISK' || riskLevel === 'CRITICAL') {
                revenueAtRisk += mrr;
            }
            return {
                tenant_id: tenantId,
                tenant_name: sub.schoolName,
                tenant_domain: sub.license?.customDomain || `${sub.license?.requestedSlug || 'tenant'}.absenta.id`,
                tenant_status: sub.status,
                mrr,
                arr: mrr * 12,
                nrr: 100,
                churn_amount: mrr * 0.02,
                upgrade_gain: mrr * 0.05,
                downgrade_loss: 0,
                risk_score: risk?.riskScore || 0,
                risk_level: riskLevel,
                risk_weighted_revenue: mrr * multiplier,
                risk_last_calculated_at: risk?.lastCalculatedAt || now,
            };
        }).sort((a, b) => b.mrr - a.mrr);
        return {
            month: now,
            revenue_at_risk: revenueAtRisk,
            tenants: enriched
        };
    },
    async getChurnAnalysis(lastNMonths) {
        const trend = await this.getMonthlyTrend(lastNMonths);
        return trend.map((p) => ({
            month: p.month,
            churn_amount: p.churn_amount,
            churn_rate: p.mrr > 0 ? (p.churn_amount / p.mrr) * 100 : 0,
            mrr: p.mrr,
        }));
    },
};
