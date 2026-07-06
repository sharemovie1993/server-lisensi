import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function calculateTenantRisk(licenseId: string, activeUsers: number, lastTappedDate?: Date) {
  let riskScore = 10; // Base score (healthy)

  // 1. Inactivity check (Last check-in tap activity)
  let finalLastTapped = lastTappedDate;
  if (!finalLastTapped) {
    const lastMetric = await prisma.tenantMetrics.findFirst({
      where: { tenantId: licenseId },
      orderBy: { createdAt: 'desc' }
    });
    if (lastMetric && lastMetric.lastTapped) {
      finalLastTapped = lastMetric.lastTapped;
    }
  }

  if (finalLastTapped) {
    const diffMs = Date.now() - new Date(finalLastTapped).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 30) {
      riskScore += 80;
    } else if (diffDays > 14) {
      riskScore += 60;
    } else if (diffDays > 7) {
      riskScore += 40;
    }
  } else {
    // No activity record at all
    riskScore += 50;
  }

  // 2. Billing overdue check
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      licenseId,
      status: 'unpaid'
    }
  });

  let maxOverdueDays = 0;
  for (const inv of unpaidInvoices) {
    const invAgeMs = Date.now() - new Date(inv.createdAt).getTime();
    const invAgeDays = invAgeMs / (1000 * 60 * 60 * 24);
    if (invAgeDays > maxOverdueDays) {
      maxOverdueDays = invAgeDays;
    }
  }

  if (maxOverdueDays > 30) {
    riskScore += 70;
  } else if (maxOverdueDays > 14) {
    riskScore += 50;
  } else if (maxOverdueDays > 7) {
    riskScore += 20;
  }

  // 3. Active Users volume check
  if (activeUsers === 0) {
    riskScore += 30;
  } else if (activeUsers < 5) {
    riskScore += 15;
  }

  // Cap score to min 0 and max 100
  riskScore = Math.max(0, Math.min(100, riskScore));

  // Determine Level (HEALTHY, WARNING, HIGH_RISK, CRITICAL)
  let riskLevel = 'HEALTHY';
  if (riskScore >= 90) {
    riskLevel = 'CRITICAL';
  } else if (riskScore >= 70) {
    riskLevel = 'HIGH_RISK';
  } else if (riskScore >= 40) {
    riskLevel = 'WARNING';
  }

  return {
    riskScore,
    riskLevel
  };
}
