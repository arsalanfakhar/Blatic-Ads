import { PrismaClient } from '@prisma/client';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface OverviewKPIs {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalPurchases: number;
  totalRevenue: number;
  avgCtr: number;
  avgCpc: number;
  avgCpm: number;
  avgRoas: number;
}

export async function getOverviewKPIs(
  prisma: PrismaClient,
  range: DateRange
): Promise<OverviewKPIs> {
  const result = await prisma.metaDailyMetric.aggregate({
    where: {
      date: { gte: range.from, lte: range.to },
    },
    _sum: {
      spend: true,
      impressions: true,
      clicks: true,
      purchases: true,
      purchaseValue: true,
    },
    _avg: {
      ctr: true,
      cpc: true,
      cpm: true,
    },
  });

  const totalSpend = result._sum.spend ?? 0;
  const totalRevenue = result._sum.purchaseValue ?? 0;

  return {
    totalSpend,
    totalImpressions: result._sum.impressions ?? 0,
    totalClicks: result._sum.clicks ?? 0,
    totalPurchases: result._sum.purchases ?? 0,
    totalRevenue,
    avgCtr: result._avg.ctr ?? 0,
    avgCpc: result._avg.cpc ?? 0,
    avgCpm: result._avg.cpm ?? 0,
    avgRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
  };
}

export async function getDailyTrends(
  prisma: PrismaClient,
  range: DateRange
): Promise<Array<{ date: string; spend: number; revenue: number; roas: number; clicks: number; impressions: number }>> {
  const rows = await prisma.metaDailyMetric.groupBy({
    by: ['date'],
    where: {
      date: { gte: range.from, lte: range.to },
    },
    _sum: {
      spend: true,
      purchaseValue: true,
      clicks: true,
      impressions: true,
    },
    orderBy: { date: 'asc' },
  });

  return rows.map((r) => {
    const spend = r._sum.spend ?? 0;
    const revenue = r._sum.purchaseValue ?? 0;
    return {
      date: r.date.toISOString().split('T')[0],
      spend,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
      clicks: r._sum.clicks ?? 0,
      impressions: r._sum.impressions ?? 0,
    };
  });
}
