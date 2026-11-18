import { PrismaClient } from '@prisma/client';
import { ACTIVE_ONLY_FILTER, metaApiFetchPaginated } from './metaApiClient';
import { bulkUpsert } from './bulkUpsert';

interface MetaCreativeRaw {
  id: string;
  name?: string;
  body?: string;
  title?: string;
  image_url?: string;
  video_id?: string;
  thumbnail_url?: string;
}

interface MetaAdRaw {
  id: string;
  adset_id: string;
  name: string;
  status: string;
  effective_status: string;
  creative?: MetaCreativeRaw;
}

const AD_FIELDS =
  'id,adset_id,name,status,effective_status,creative{id,name,body,title,image_url,video_id,thumbnail_url}';

// Nested creative fields make each ad heavy, so pages are smaller than the 500 default
const AD_PAGE_SIZE = '100';

export async function syncAds(
  prisma: PrismaClient,
  accountId: string,
  activeOnly: boolean
): Promise<number> {
  const params: Record<string, string> = { fields: AD_FIELDS, limit: AD_PAGE_SIZE };
  if (activeOnly) params.filtering = ACTIVE_ONLY_FILTER;

  const ads = await metaApiFetchPaginated<MetaAdRaw>(`/${accountId}/ads`, params);
  if (ads.length === 0) return 0;

  const creatives = new Map<string, MetaCreativeRaw>();
  for (const ad of ads) if (ad.creative) creatives.set(ad.creative.id, ad.creative);

  await bulkUpsert(prisma, {
    table: 'meta_creatives',
    conflictColumns: ['metaCreativeId'],
    columns: ['metaCreativeId', 'name', 'body', 'title', 'imageUrl', 'videoId', 'thumbnailUrl'],
    timestamps: true,
    rows: [...creatives.values()].map((c) => [
      c.id,
      c.name ?? null,
      c.body ?? null,
      c.title ?? null,
      c.image_url ?? null,
      c.video_id ?? null,
      c.thumbnail_url ?? null,
    ]),
  });

  const [adSets, creativeRows] = await Promise.all([
    prisma.metaAdSet.findMany({
      where: { metaAdSetId: { in: [...new Set(ads.map((a) => a.adset_id))] } },
      select: { id: true, metaAdSetId: true },
    }),
    prisma.metaCreative.findMany({
      where: { metaCreativeId: { in: [...creatives.keys()] } },
      select: { id: true, metaCreativeId: true },
    }),
  ]);
  const adSetMap = new Map(adSets.map((s) => [s.metaAdSetId, s.id]));
  const creativeMap = new Map(creativeRows.map((c) => [c.metaCreativeId, c.id]));

  return bulkUpsert(prisma, {
    table: 'meta_ads',
    conflictColumns: ['metaAdId'],
    columns: ['metaAdId', 'adSetId', 'creativeId', 'name', 'status', 'effectiveStatus'],
    timestamps: true,
    rows: ads
      .filter((a) => adSetMap.has(a.adset_id))
      .map((a) => [
        a.id,
        adSetMap.get(a.adset_id)!,
        a.creative ? (creativeMap.get(a.creative.id) ?? null) : null,
        a.name,
        a.status,
        a.effective_status,
      ]),
  });
}
