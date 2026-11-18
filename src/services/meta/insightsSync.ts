import { PrismaClient } from '@prisma/client';
import { metaApiFetchPaginated } from './metaApiClient';
import { bulkUpsert } from './bulkUpsert';

interface MetaAction {
  action_type: string;
  value: string;
}

interface MetaInsightRaw {
  date_start: string;
  campaign_id: string;
  adset_id: string;
  ad_id: string;
  spend: string;
  impressions: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: MetaAction[];
  purchase_roas?: Array<{ action_type: string; value: string }>;
}

const INSIGHT_FIELDS = [
  'campaign_id',
  'adset_id',
  'ad_id',
  'spend',
  'impressions',
  'reach',
  'clicks',
  'ctr',
  'cpc',
  'cpm',
  'actions',
  'purchase_roas',
].join(',');

// A single year-wide insights request fails on Meta's side; windows of this size return reliably
const WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function findActionValue(actions: MetaAction[] | undefined, type: string): number {
  const a = actions?.find((x) => x.action_type === type);
  return a ? parseFloat(a.value) : 0;
}

export function buildWindows(since: Date, until: Date): Array<{ since: string; until: string }> {
  const windows: Array<{ since: string; until: string }> = [];
  for (let start = since.getTime(); start <= until.getTime(); start += WINDOW_DAYS * DAY_MS) {
    const end = Math.min(start + (WINDOW_DAYS - 1) * DAY_MS, until.getTime());
    windows.push({ since: isoDate(new Date(start)), until: isoDate(new Date(end)) });
  }
  return windows;
}

export async function syncInsights(
  prisma: PrismaClient,
  accountId: string,
  accountDbId: string,
  since: Date
): Promise<number> {
  const insights: MetaInsightRaw[] = [];
  for (const window of buildWindows(since, new Date())) {
    const rows = await metaApiFetchPaginated<MetaInsightRaw>(`/${accountId}/insights`, {
      fields: INSIGHT_FIELDS,
      level: 'ad',
      time_increment: '1',
      time_range: JSON.stringify(window),
    });
    insights.push(...rows);
  }
  if (insights.length === 0) return 0;

  const [ads, campaigns, adSets] = await Promise.all([
    prisma.metaAd.findMany({
      where: { metaAdId: { in: [...new Set(insights.map((i) => i.ad_id))] } },
      select: { id: true, metaAdId: true },
    }),
    prisma.metaCampaign.findMany({
      where: { metaCampaignId: { in: [...new Set(insights.map((i) => i.campaign_id))] } },
      select: { id: true, metaCampaignId: true },
    }),
    prisma.metaAdSet.findMany({
      where: { metaAdSetId: { in: [...new Set(insights.map((i) => i.adset_id))] } },
      select: { id: true, metaAdSetId: true },
    }),
  ]);
  const adMap = new Map(ads.map((a) => [a.metaAdId, a.id]));
  const campaignMap = new Map(campaigns.map((c) => [c.metaCampaignId, c.id]));
  const adSetMap = new Map(adSets.map((a) => [a.metaAdSetId, a.id]));

  // raw actions JSON is not stored: the funnel columns below are all the dashboard reads
  return bulkUpsert(prisma, {
    table: 'meta_daily_metrics',
    conflictColumns: ['date', 'adId'],
    columns: [
      'date',
      'adId',
      'accountId',
      'campaignId',
      'adSetId',
      'spend',
      'impressions',
      'reach',
      'clicks',
      'ctr',
      'cpc',
      'cpm',
      'purchases',
      'purchaseValue',
      'metaRoas',
      'addToCart',
      'initiateCheckout',
      'leads',
    ],
    rows: insights
      .filter((i) => adMap.has(i.ad_id) && campaignMap.has(i.campaign_id) && adSetMap.has(i.adset_id))
      .map((i) => [
        new Date(i.date_start),
        adMap.get(i.ad_id)!,
        accountDbId,
        campaignMap.get(i.campaign_id)!,
        adSetMap.get(i.adset_id)!,
        parseFloat(i.spend),
        parseInt(i.impressions, 10),
        i.reach ? parseInt(i.reach, 10) : 0,
        i.clicks ? parseInt(i.clicks, 10) : 0,
        i.ctr ? parseFloat(i.ctr) : 0,
        i.cpc ? parseFloat(i.cpc) : 0,
        i.cpm ? parseFloat(i.cpm) : 0,
        Math.round(findActionValue(i.actions, 'omni_purchase')),
        findActionValue(i.actions, 'omni_purchase_value'),
        i.purchase_roas?.[0] ? parseFloat(i.purchase_roas[0].value) : 0,
        Math.round(findActionValue(i.actions, 'add_to_cart')),
        Math.round(findActionValue(i.actions, 'initiate_checkout')),
        Math.round(findActionValue(i.actions, 'lead')),
      ]),
  });
}
