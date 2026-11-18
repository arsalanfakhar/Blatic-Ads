import { PrismaClient } from '@prisma/client';
import { DateRange } from './overviewService';

export interface CampaignWithMetrics {
  id: string;
  metaCampaignId: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number;
  ctr: number;
  cpc: number;
}

export async function getCampaignsWithMetrics(
  prisma: PrismaClient,
  range: DateRange
): Promise<CampaignWithMetrics[]> {
  const metricsGrouped = await prisma.metaDailyMetric.groupBy({
    by: ['campaignId'],
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
  });

  const campaignIds = metricsGrouped.map((m) => m.campaignId);

  const campaigns = await prisma.metaCampaign.findMany({
    where: { id: { in: campaignIds } },
    select: {
      id: true,
      metaCampaignId: true,
      name: true,
      status: true,
      effectiveStatus: true,
      objective: true,
    },
  });

  const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

  return metricsGrouped
    .map((m) => {
      const c = campaignMap.get(m.campaignId);
      if (!c) return null;

      const spend = m._sum.spend ?? 0;
      const impressions = m._sum.impressions ?? 0;
      const clicks = m._sum.clicks ?? 0;
      const revenue = m._sum.purchaseValue ?? 0;

      return {
        id: c.id,
        metaCampaignId: c.metaCampaignId,
        name: c.name,
        status: c.status,
        effectiveStatus: c.effectiveStatus,
        objective: c.objective,
        spend,
        impressions,
        clicks,
        purchases: m._sum.purchases ?? 0,
        revenue,
        roas: spend > 0 ? revenue / spend : 0,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
      };
    })
    .filter((x): x is CampaignWithMetrics => x !== null)
    .sort((a, b) => b.spend - a.spend);
}

export async function getCampaignDetail(
  prisma: PrismaClient,
  campaignId: string,
  range: DateRange
) {
  const campaign = await prisma.metaCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      metaCampaignId: true,
      name: true,
      status: true,
      effectiveStatus: true,
      objective: true,
      bidStrategy: true,
      dailyBudget: true,
      lifetimeBudget: true,
      startTime: true,
      stopTime: true,
    },
  });

  if (!campaign) return null;

  const adSetMetrics = await prisma.metaDailyMetric.groupBy({
    by: ['adSetId'],
    where: {
      campaignId: campaign.id,
      date: { gte: range.from, lte: range.to },
    },
    _sum: {
      spend: true,
      impressions: true,
      clicks: true,
      purchases: true,
      purchaseValue: true,
    },
  });

  const adSetIds = adSetMetrics.map((m) => m.adSetId);
  const adSets = await prisma.metaAdSet.findMany({
    where: { id: { in: adSetIds } },
    select: { id: true, name: true, status: true, effectiveStatus: true, optimizationGoal: true },
  });

  const adSetMap = new Map(adSets.map((a) => [a.id, a]));

  const breakdown = adSetMetrics.map((m) => {
    const as = adSetMap.get(m.adSetId);
    const spend = m._sum.spend ?? 0;
    const clicks = m._sum.clicks ?? 0;
    const impressions = m._sum.impressions ?? 0;
    const revenue = m._sum.purchaseValue ?? 0;

    return {
      id: m.adSetId,
      name: as?.name ?? 'Unknown',
      status: as?.effectiveStatus ?? 'UNKNOWN',
      optimizationGoal: as?.optimizationGoal ?? null,
      spend,
      impressions,
      clicks,
      purchases: m._sum.purchases ?? 0,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
    };
  });

  return { ...campaign, adSets: breakdown.sort((a, b) => b.spend - a.spend) };
}
