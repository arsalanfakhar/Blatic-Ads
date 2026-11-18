import { PrismaClient } from '@prisma/client';
import { DateRange } from './overviewService';

export interface CreativeWithMetrics {
  id: string;
  metaCreativeId: string;
  name: string | null;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  tags: string[];
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number;
  ctr: number;
  cpc: number;
}

export async function getCreativesWithMetrics(
  prisma: PrismaClient,
  range: DateRange
): Promise<CreativeWithMetrics[]> {
  const adMetrics = await prisma.metaDailyMetric.groupBy({
    by: ['adId'],
    where: { date: { gte: range.from, lte: range.to } },
    _sum: {
      spend: true,
      impressions: true,
      clicks: true,
      purchases: true,
      purchaseValue: true,
    },
  });

  if (adMetrics.length === 0) return [];

  const adIds = adMetrics.map((m) => m.adId);
  const ads = await prisma.metaAd.findMany({
    where: { id: { in: adIds } },
    select: { id: true, creativeId: true },
  });

  const adToCreative = new Map(
    ads.filter((a) => a.creativeId).map((a) => [a.id, a.creativeId!])
  );

  const creativeMetrics = new Map<string, { spend: number; impressions: number; clicks: number; purchases: number; revenue: number }>();
  for (const m of adMetrics) {
    const creativeId = adToCreative.get(m.adId);
    if (!creativeId) continue;

    const existing = creativeMetrics.get(creativeId) ?? { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    existing.spend += m._sum.spend ?? 0;
    existing.impressions += m._sum.impressions ?? 0;
    existing.clicks += m._sum.clicks ?? 0;
    existing.purchases += m._sum.purchases ?? 0;
    existing.revenue += m._sum.purchaseValue ?? 0;
    creativeMetrics.set(creativeId, existing);
  }

  const creativeIds = [...creativeMetrics.keys()];
  const creatives = await prisma.metaCreative.findMany({
    where: { id: { in: creativeIds } },
    select: {
      id: true,
      metaCreativeId: true,
      name: true,
      title: true,
      body: true,
      imageUrl: true,
      thumbnailUrl: true,
      videoUrl: true,
      tags: { select: { tag: true } },
    },
  });

  return creatives
    .map((c) => {
      const m = creativeMetrics.get(c.id);
      if (!m) return null;

      return {
        id: c.id,
        metaCreativeId: c.metaCreativeId,
        name: c.name,
        title: c.title,
        body: c.body,
        imageUrl: c.imageUrl,
        thumbnailUrl: c.thumbnailUrl,
        videoUrl: c.videoUrl,
        tags: c.tags.map((t) => t.tag),
        spend: m.spend,
        impressions: m.impressions,
        clicks: m.clicks,
        purchases: m.purchases,
        revenue: m.revenue,
        roas: m.spend > 0 ? m.revenue / m.spend : 0,
        ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
        cpc: m.clicks > 0 ? m.spend / m.clicks : 0,
      };
    })
    .filter((x): x is CreativeWithMetrics => x !== null)
    .sort((a, b) => b.spend - a.spend);
}

export async function getPerformanceByTag(
  prisma: PrismaClient,
  range: DateRange
): Promise<Array<{ tag: string; count: number; avgRoas: number; avgCtr: number; totalSpend: number }>> {
  const allCreatives = await getCreativesWithMetrics(prisma, range);

  const tagMap = new Map<string, { spend: number; revenue: number; impressions: number; clicks: number; count: number }>();

  for (const c of allCreatives) {
    for (const tag of c.tags) {
      const existing = tagMap.get(tag) ?? { spend: 0, revenue: 0, impressions: 0, clicks: 0, count: 0 };
      existing.spend += c.spend;
      existing.revenue += c.revenue;
      existing.impressions += c.impressions;
      existing.clicks += c.clicks;
      existing.count += 1;
      tagMap.set(tag, existing);
    }
  }

  return [...tagMap.entries()]
    .map(([tag, m]) => ({
      tag,
      count: m.count,
      avgRoas: m.spend > 0 ? m.revenue / m.spend : 0,
      avgCtr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
      totalSpend: m.spend,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);
}
