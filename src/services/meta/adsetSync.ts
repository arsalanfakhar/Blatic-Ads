import { PrismaClient } from '@prisma/client';
import { ACTIVE_ONLY_FILTER, metaApiFetchPaginated } from './metaApiClient';
import { bulkUpsert } from './bulkUpsert';

interface MetaAdSetRaw {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  effective_status: string;
  daily_budget?: string;
  optimization_goal?: string;
  start_time?: string;
  stop_time?: string;
}

// targeting is intentionally not synced: it is the largest payload per row and nothing reads it
const ADSET_FIELDS =
  'id,campaign_id,name,status,effective_status,daily_budget,optimization_goal,start_time,stop_time';

export async function syncAdSets(
  prisma: PrismaClient,
  accountId: string,
  activeOnly: boolean
): Promise<number> {
  const params: Record<string, string> = { fields: ADSET_FIELDS };
  if (activeOnly) params.filtering = ACTIVE_ONLY_FILTER;

  const adsets = await metaApiFetchPaginated<MetaAdSetRaw>(`/${accountId}/adsets`, params);
  if (adsets.length === 0) return 0;

  const campaigns = await prisma.metaCampaign.findMany({
    where: { metaCampaignId: { in: [...new Set(adsets.map((a) => a.campaign_id))] } },
    select: { id: true, metaCampaignId: true },
  });
  const campaignMap = new Map(campaigns.map((c) => [c.metaCampaignId, c.id]));

  return bulkUpsert(prisma, {
    table: 'meta_ad_sets',
    conflictColumns: ['metaAdSetId'],
    columns: [
      'metaAdSetId',
      'campaignId',
      'name',
      'status',
      'effectiveStatus',
      'dailyBudget',
      'optimizationGoal',
      'startTime',
      'stopTime',
    ],
    timestamps: true,
    rows: adsets
      .filter((a) => campaignMap.has(a.campaign_id))
      .map((a) => [
        a.id,
        campaignMap.get(a.campaign_id)!,
        a.name,
        a.status,
        a.effective_status,
        a.daily_budget ? parseFloat(a.daily_budget) / 100 : null,
        a.optimization_goal ?? null,
        a.start_time ? new Date(a.start_time) : null,
        a.stop_time ? new Date(a.stop_time) : null,
      ]),
  });
}
