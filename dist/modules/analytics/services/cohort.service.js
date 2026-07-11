"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cohortService = void 0;
const helpers_1 = require("../../../routes/license/helpers");
function utcMonthStart(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}
function monthKey(d) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
exports.cohortService = {
    async calculateAndUpsertCohorts(_db) {
        // Cohorts are calculated dynamically in getCohortRetention
        return { cohorts_processed: 1, latest_snapshot_month: new Date() };
    },
    async getCohortRetention(db, limit, productId) {
        const take = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 24;
        const subWhere = {};
        if (productId && productId !== 'all') {
            subWhere.productId = (0, helpers_1.normalizeProductId)(productId);
        }
        // Get all subscriptions
        const subscriptions = await db.subscription.findMany({
            where: subWhere,
            select: {
                licenseId: true,
                startDate: true,
                endDate: true,
                status: true,
                license: {
                    select: {
                        plan: {
                            select: {
                                priceMonthly: true
                            }
                        }
                    }
                }
            }
        });
        const cohortMap = new Map();
        const tenantStartDates = new Map();
        const tenantRevenue = new Map();
        for (const sub of subscriptions) {
            const tenantId = sub.licenseId;
            const start = new Date(sub.startDate);
            if (isNaN(start.getTime()))
                continue;
            const currentStart = tenantStartDates.get(tenantId);
            if (!currentStart || start < currentStart) {
                tenantStartDates.set(tenantId, start);
            }
            const price = sub.license?.plan?.priceMonthly || 0;
            tenantRevenue.set(tenantId, (tenantRevenue.get(tenantId) || 0) + price);
        }
        // Group tenants by cohort month
        for (const [tenantId, startDate] of tenantStartDates.entries()) {
            const monthStart = utcMonthStart(startDate);
            const key = monthKey(monthStart);
            if (!cohortMap.has(key)) {
                cohortMap.set(key, new Set());
            }
            cohortMap.get(key).add(tenantId);
        }
        const sortedCohortKeys = Array.from(cohortMap.keys()).sort().reverse().slice(0, take);
        const result = [];
        const now = new Date();
        for (const key of sortedCohortKeys) {
            const tenantIds = cohortMap.get(key);
            const activeCount = tenantIds.size;
            const cohortDate = new Date(key);
            let retained1 = 0;
            let retained3 = 0;
            let retained6 = 0;
            let retained12 = 0;
            let revenue = 0;
            for (const tenantId of tenantIds) {
                revenue += tenantRevenue.get(tenantId) || 0;
                const startDate = tenantStartDates.get(tenantId);
                const monthsDiff = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
                // Simple status/activity check based on sub status and age
                const sub = subscriptions.find(s => s.licenseId === tenantId);
                const isActive = sub?.status === 'active';
                if (isActive) {
                    if (monthsDiff >= 1)
                        retained1++;
                    if (monthsDiff >= 3)
                        retained3++;
                    if (monthsDiff >= 6)
                        retained6++;
                    if (monthsDiff >= 12)
                        retained12++;
                }
            }
            result.push({
                cohort_month: cohortDate,
                month: now,
                active_count: activeCount,
                churned_count: activeCount - retained1,
                retained_after_1_month: retained1,
                retained_after_3_month: retained3,
                retained_after_6_month: retained6,
                retained_after_12_month: retained12,
                revenue_generated: revenue,
                calculated_at: now
            });
        }
        return result.reverse();
    }
};
