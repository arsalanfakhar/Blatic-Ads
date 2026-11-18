import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { success, unauthorized, failure } from '@/lib/api';
import { getCreativesWithMetrics } from '@/services/analytics/creativeService';
import { parseDateRange } from '@/services/analytics/parseDateRange';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const idsParam = req.nextUrl.searchParams.get('ids');
  if (!idsParam) return failure('ids query parameter required', 400);

  const ids = idsParam.split(',').filter(Boolean);
  if (ids.length < 2) return failure('At least 2 creative IDs required', 400);

  const range = parseDateRange(req.nextUrl.searchParams);
  const all = await getCreativesWithMetrics(prisma, range);
  const idSet = new Set(ids);
  const compared = all.filter((c) => idSet.has(c.id));

  return success(compared);
}
