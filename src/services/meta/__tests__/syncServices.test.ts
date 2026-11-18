import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';

vi.mock('../metaApiClient', () => ({
  ACTIVE_ONLY_FILTER: '[active-filter]',
  metaApiFetchPaginated: vi.fn(),
}));

import { metaApiFetchPaginated } from '../metaApiClient';
import { syncCampaigns } from '../campaignSync';
import { syncAdSets } from '../adsetSync';
import { syncAds } from '../adSync';
import { syncInsights, buildWindows } from '../insightsSync';

const fetchMock = vi.mocked(metaApiFetchPaginated);

function mockPrisma() {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    metaCampaign: { findMany: vi.fn().mockResolvedValue([{ id: 'db-c1', metaCampaignId: 'c1' }]) },
    metaAdSet: { findMany: vi.fn().mockResolvedValue([{ id: 'db-s1', metaAdSetId: 's1' }]) },
    metaAd: { findMany: vi.fn().mockResolvedValue([{ id: 'db-a1', metaAdId: 'a1' }]) },
    metaCreative: { findMany: vi.fn().mockResolvedValue([{ id: 'db-cr1', metaCreativeId: 'cr1' }]) },
  } as unknown as PrismaClient & { $executeRaw: ReturnType<typeof vi.fn> };
}

beforeEach(() => fetchMock.mockReset());

describe('syncCampaigns', () => {
  it('writes all campaigns in one query and converts budgets from cents', async () => {
    fetchMock.mockResolvedValue([
      { id: 'c1', name: 'A', status: 'ACTIVE', effective_status: 'ACTIVE', daily_budget: '250000' },
      { id: 'c2', name: 'B', status: 'PAUSED', effective_status: 'PAUSED' },
    ]);
    const prisma = mockPrisma();
    expect(await syncCampaigns(prisma, 'act_1', 'db-acct', true)).toBe(2);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw.mock.calls[0][0].values).toContain(2500);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ filtering: '[active-filter]' });
  });

  it('skips the active filter on a full sync', async () => {
    fetchMock.mockResolvedValue([]);
    await syncCampaigns(mockPrisma(), 'act_1', 'db-acct', false);
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('filtering');
  });
});

describe('syncAdSets', () => {
  it('upserts only ad sets whose campaign exists, with a single lookup and a single write', async () => {
    fetchMock.mockResolvedValue([
      { id: 's1', campaign_id: 'c1', name: 'ok', status: 'ACTIVE', effective_status: 'ACTIVE' },
      { id: 's2', campaign_id: 'missing', name: 'orphan', status: 'ACTIVE', effective_status: 'ACTIVE' },
    ]);
    const prisma = mockPrisma();
    expect(await syncAdSets(prisma, 'act_1', false)).toBe(1);
    expect(prisma.metaCampaign.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw.mock.calls[0][0].values).toContain('db-c1');
  });

  it('does not request the heavy targeting field', async () => {
    fetchMock.mockResolvedValue([]);
    await syncAdSets(mockPrisma(), 'act_1', false);
    expect(fetchMock.mock.calls[0][1]?.fields).not.toContain('targeting');
  });
});

describe('syncAds', () => {
  it('upserts shared creatives once and links ads to them', async () => {
    const creative = { id: 'cr1', name: 'Reel' };
    fetchMock.mockResolvedValue([
      { id: 'a1', adset_id: 's1', name: 'ad1', status: 'ACTIVE', effective_status: 'ACTIVE', creative },
      { id: 'a2', adset_id: 's1', name: 'ad2', status: 'ACTIVE', effective_status: 'ACTIVE', creative },
    ]);
    const prisma = mockPrisma();
    expect(await syncAds(prisma, 'act_1', false)).toBe(2);
    // one write for creatives, one for ads
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    const creativeValues = prisma.$executeRaw.mock.calls[0][0].values;
    expect(creativeValues.filter((v: unknown) => v === 'cr1')).toHaveLength(1);
    expect(prisma.$executeRaw.mock.calls[1][0].values).toContain('db-cr1');
  });

  it('writes nothing when Meta returns no ads', async () => {
    fetchMock.mockResolvedValue([]);
    const prisma = mockPrisma();
    expect(await syncAds(prisma, 'act_1', false)).toBe(0);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});

describe('buildWindows', () => {
  it('uses a single window for an incremental sync', () => {
    expect(buildWindows(new Date('2026-11-07'), new Date('2026-11-10'))).toEqual([
      { since: '2026-11-07', until: '2026-11-10' },
    ]);
  });

  it('splits a year-to-date range into contiguous 14-day windows that never pass today', () => {
    const w = buildWindows(new Date('2026-01-01'), new Date('2026-11-10'));
    expect(w[0]).toEqual({ since: '2026-01-01', until: '2026-01-14' });
    expect(w[1].since).toBe('2026-01-15');
    expect(w[w.length - 1].until).toBe('2026-11-10');
    expect(w.length).toBe(Math.ceil(314 / 14));
  });
});

describe('syncInsights', () => {
  const row = (over = {}) => ({
    date_start: '2026-11-08',
    campaign_id: 'c1',
    adset_id: 's1',
    ad_id: 'a1',
    spend: '1200.5',
    impressions: '9000',
    actions: [{ action_type: 'omni_purchase', value: '3' }],
    ...over,
  });

  it('maps funnel actions into columns and skips rows whose ad is unknown', async () => {
    fetchMock.mockResolvedValue([row(), row({ ad_id: 'unknown' })]);
    const prisma = mockPrisma();
    expect(await syncInsights(prisma, 'act_1', 'db-acct', new Date('2026-11-07'))).toBe(1);
    const values = prisma.$executeRaw.mock.calls[0][0].values;
    expect(values).toContain(1200.5);
    expect(values).toContain(3);
    expect(values).toContain('db-a1');
  });

  it('fetches one window per 14 days on a full sync', async () => {
    fetchMock.mockResolvedValue([]);
    await syncInsights(mockPrisma(), 'act_1', 'db-acct', new Date('2026-01-01'));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(20);
  });
});
