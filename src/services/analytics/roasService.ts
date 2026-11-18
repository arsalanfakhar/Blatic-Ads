import { PrismaClient } from '@prisma/client';
import { DateRange } from './overviewService';
import { isAtlasConfigured, atlasClient } from '@/lib/atlasClient';

export interface TrueRoasResult {
  totalAdSpend: number;
  shopifyRevenue: number;
  atlasRevenue: number | null;
  trueRoas: number;
  metaReportedRoas: number;
  revenueSource: 'atlas' | 'shopify';
}

export async function getTrueRoas(
  prisma: PrismaClient,
  range: DateRange
): Promise<TrueRoasResult> {
  const [spendResult, shopifyResult] = await Promise.all([
    prisma.metaDailyMetric.aggregate({
      where: { date: { gte: range.from, lte: range.to } },
      _sum: { spend: true, purchaseValue: true },
    }),
    prisma.shopifyOrder.aggregate({
      where: {
        orderDate: { gte: range.from, lte: range.to },
        financialStatus: { in: ['paid', 'partially_refunded'] },
      },
      _sum: { totalPrice: true, totalRefunded: true },
    }),
  ]);

  const totalAdSpend = spendResult._sum.spend ?? 0;
  const metaReportedRevenue = spendResult._sum.purchaseValue ?? 0;
  const metaReportedRoas = totalAdSpend > 0 ? metaReportedRevenue / totalAdSpend : 0;

  const shopifyRevenue =
    (shopifyResult._sum.totalPrice ?? 0) - (shopifyResult._sum.totalRefunded ?? 0);

  let atlasRevenue: number | null = null;

  if (isAtlasConfigured()) {
    const atlas = atlasClient();
    const { data } = await atlas
      .from('oms_orders')
      .select('grand_total')
      .gte('created_at', range.from.toISOString())
      .lte('created_at', range.to.toISOString())
      .in('status', ['delivered', 'completed']);

    if (data && data.length > 0) {
      atlasRevenue = data.reduce(
        (sum: number, row: { grand_total: number }) => sum + (row.grand_total ?? 0),
        0
      );
    }
  }

  const primaryRevenue = atlasRevenue !== null ? atlasRevenue : shopifyRevenue;
  const trueRoas = totalAdSpend > 0 ? primaryRevenue / totalAdSpend : 0;

  return {
    totalAdSpend,
    shopifyRevenue,
    atlasRevenue,
    trueRoas,
    metaReportedRoas,
    revenueSource: atlasRevenue !== null ? 'atlas' : 'shopify',
  };
}
