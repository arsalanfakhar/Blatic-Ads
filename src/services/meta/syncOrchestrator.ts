import { PrismaClient, SyncSource, SyncStatus } from '@prisma/client';
import { syncCampaigns } from './campaignSync';
import { syncAdSets } from './adsetSync';
import { syncAds } from './adSync';
import { syncInsights } from './insightsSync';

interface SyncResult {
  campaigns: number;
  adSets: number;
  ads: number;
  metrics: number;
  durationMs: number;
  error?: string;
}

const INCREMENTAL_DAYS = 3;
const STALE_RUN_MS = 30 * 60 * 1000;

async function timed(label: string, fn: () => Promise<number>): Promise<number> {
  const t = Date.now();
  const n = await fn();
  console.log(`[sync] ${label}: ${n} rows in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  return n;
}

export async function runMetaSync(
  prisma: PrismaClient,
  options: { fullSync?: boolean } = {}
): Promise<SyncResult> {
  const start = Date.now();
  const isIncremental = !options.fullSync;
  const now = new Date();
  const since = isIncremental
    ? new Date(now.getTime() - INCREMENTAL_DAYS * 86_400_000)
    : new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  // A run whose process died stays RUNNING forever and misleads the status page
  await prisma.syncRun.updateMany({
    where: { status: SyncStatus.RUNNING, startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
    data: { status: SyncStatus.FAILED, finishedAt: new Date(), error: 'Timed out (process stopped before finishing)' },
  });

  const syncRun = await prisma.syncRun.create({
    data: { source: SyncSource.META, status: SyncStatus.RUNNING },
  });

  const accountIds = getAdAccountIds();
  if (accountIds.length === 0) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: SyncStatus.FAILED, finishedAt: new Date(), error: 'META_AD_ACCOUNT_IDS is not configured' },
    });
    throw new Error('META_AD_ACCOUNT_IDS is not configured');
  }

  const accessToken = process.env.META_ACCESS_TOKEN ?? '';
  const result: SyncResult = { campaigns: 0, adSets: 0, ads: 0, metrics: 0, durationMs: 0 };

  console.log(`[sync] ${isIncremental ? 'incremental' : 'full'} sync from ${since.toISOString().slice(0, 10)}`);

  // Accounts are independent, so they sync in parallel
  const outcomes = await Promise.allSettled(
    accountIds.map(async (accountId) => {
      const account = await prisma.metaAdAccount.upsert({
        where: { accountId },
        update: {},
        create: { accountId, name: accountId, accessToken, currency: 'PKR', timezone: 'Asia/Karachi' },
        select: { id: true },
      });

      const campaigns = await timed(`${accountId} campaigns`, () =>
        syncCampaigns(prisma, accountId, account.id, isIncremental)
      );
      const adSets = await timed(`${accountId} adsets`, () => syncAdSets(prisma, accountId, isIncremental));
      const ads = await timed(`${accountId} ads`, () => syncAds(prisma, accountId, isIncremental));
      const metrics = await timed(`${accountId} insights`, () =>
        syncInsights(prisma, accountId, account.id, since)
      );
      return { campaigns, adSets, ads, metrics };
    })
  );

  const errors: string[] = [];
  for (const outcome of outcomes) {
    if (outcome.status === 'fulfilled') {
      result.campaigns += outcome.value.campaigns;
      result.adSets += outcome.value.adSets;
      result.ads += outcome.value.ads;
      result.metrics += outcome.value.metrics;
    } else {
      errors.push(outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason));
    }
  }

  result.durationMs = Date.now() - start;
  const itemCount = result.campaigns + result.adSets + result.ads + result.metrics;

  if (errors.length > 0) {
    result.error = errors.join(' | ');
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: SyncStatus.FAILED, finishedAt: new Date(), itemCount, error: result.error },
    });
    throw new Error(result.error);
  }

  await prisma.syncRun.update({
    where: { id: syncRun.id },
    data: { status: SyncStatus.SUCCESS, finishedAt: new Date(), itemCount },
  });
  console.log(`[sync] done: ${itemCount} rows in ${(result.durationMs / 1000).toFixed(1)}s`);
  return result;
}

function getAdAccountIds(): string[] {
  const raw = process.env.META_AD_ACCOUNT_IDS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => (id.startsWith('act_') ? id : `act_${id}`));
}
