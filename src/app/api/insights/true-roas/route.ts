import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { success, unauthorized } from '@/lib/api';
import { getTrueRoas } from '@/services/analytics/roasService';
import { parseDateRange } from '@/services/analytics/parseDateRange';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const range = parseDateRange(req.nextUrl.searchParams);
  const roas = await getTrueRoas(prisma, range);
  return success(roas);
}
