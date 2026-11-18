import { PrismaClient } from '@prisma/client';
import { ACTIVE_ONLY_FILTER, metaApiFetchPaginated } from './metaApiClient';
import { bulkUpsert } from './bulkUpsert';

interface MetaCampaignRaw {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective?: string;
  bid_strategy?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

const CAMPAIGN_FIELDS =
  'id,name,status,effective_status,objective,bid_strategy,daily_budget,lifetime_budget,start_time,stop_time';

export async function syncCampaigns(
  prisma: PrismaClient,
  accountId: string,
  accountDbId: string,
  activeOnly: boolean
): Promise<number> {
  const params: Record<string, string> = { fields: CAMPAIGN_FIELDS };
  if (activeOnly) params.filtering = ACTIVE_ONLY_FILTER;

  const campaigns = await metaApiFetchPaginated<MetaCampaignRaw>(`/${accountId}/campaigns`, params);

  return bulkUpsert(prisma, {
    table: 'meta_campaigns',
    conflictColumns: ['metaCampaignId'],
    columns: [
      'metaCampaignId',
      'accountId',
      'name',
      'status',
      'effectiveStatus',
      'objective',
      'bidStrategy',
      'dailyBudget',
      'lifetimeBudget',
      'startTime',
      'stopTime',
    ],
    timestamps: true,
    rows: campaigns.map((c) => [
      c.id,
      accountDbId,
      c.name,
      c.status,
      c.effective_status,
      c.objective ?? null,
      c.bid_strategy ?? null,
      c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
      c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
      c.start_time ? new Date(c.start_time) : null,
      c.stop_time ? new Date(c.stop_time) : null,
    ]),
  });
}
