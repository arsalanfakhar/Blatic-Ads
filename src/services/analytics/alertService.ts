import { PrismaClient } from '@prisma/client';
import { DateRange } from './overviewService';

export interface BudgetBleedAlert {
  adSetId: string;
  adSetName: string;
  campaignName: string;
  severity: 'high' | 'medium' | 'low';
  reason: string;
  spend: number;
  roas: number;
  ctr: number;
  cpc: number;
}

export async function detectBudgetBleed(
  prisma: PrismaClient,
  range: DateRange
): Promise<BudgetBleedAlert[]> {
  const adSetMetrics = await prisma.metaDailyMetric.groupBy({
    by: ['adSetId'],
    where: { date: { gte: range.from, lte: range.to } },
    _sum: { spend: true, impressions: true, clicks: true, purchases: true, purchaseValue: true },
    _avg: { ctr: true, cpc: true },
  });

  const totalSpend = adSetMetrics.reduce((s, m) => s + (m._sum.spend ?? 0), 0);
  const totalClicks = adSetMetrics.reduce((s, m) => s + (m._sum.clicks ?? 0), 0);
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  const adSetIds = adSetMetrics.map((m) => m.adSetId);
  const adSets = await prisma.metaAdSet.findMany({
    where: { id: { in: adSetIds } },
    select: {
      id: true,
      name: true,
      effectiveStatus: true,
      campaign: { select: { name: true } },
    },
  });
  const adSetMap = new Map(adSets.map((a) => [a.id, a]));

  const alerts: BudgetBleedAlert[] = [];

  for (const m of adSetMetrics) {
    const spend = m._sum.spend ?? 0;
    if (spend < 100) continue;

    const impressions = m._sum.impressions ?? 0;
    const clicks = m._sum.clicks ?? 0;
    const revenue = m._sum.purchaseValue ?? 0;
    const roas = spend > 0 ? revenue / spend : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;

    const as = adSetMap.get(m.adSetId);
    if (!as) continue;

    const reasons: string[] = [];
    let severity: 'high' | 'medium' | 'low' = 'low';

    if (roas < 1 && spend > 500) {
      reasons.push(`ROAS ${roas.toFixed(2)}x with Rs ${spend.toFixed(0)} spend`);
      severity = 'high';
    } else if (roas < 1.5 && spend > 200) {
      reasons.push(`Low ROAS ${roas.toFixed(2)}x`);
      severity = 'medium';
    }

    if (ctr < 0.5) {
      reasons.push(`CTR ${ctr.toFixed(2)}% (below 0.5%)`);
      severity = severity === 'low' ? 'medium' : severity;
    }

    if (avgCpc > 0 && cpc > avgCpc * 2) {
      reasons.push(`CPC Rs ${cpc.toFixed(0)} is 2x+ above average Rs ${avgCpc.toFixed(0)}`);
      severity = severity === 'low' ? 'medium' : severity;
    }

    if (reasons.length > 0) {
      alerts.push({
        adSetId: m.adSetId,
        adSetName: as.name,
        campaignName: as.campaign.name,
        severity,
        reason: reasons.join('; '),
        spend,
        roas,
        ctr,
        cpc,
      });
    }
  }

  return alerts.sort((a, b) => {
    const sev = { high: 0, medium: 1, low: 2 };
    return sev[a.severity] - sev[b.severity] || b.spend - a.spend;
  });
}
