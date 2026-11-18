import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { success, unauthorized, failure } from '@/lib/api';
import { getCampaignDetail } from '@/services/analytics/campaignService';
import { parseDateRange } from '@/services/analytics/parseDateRange';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const range = parseDateRange(req.nextUrl.searchParams);
  const campaign = await getCampaignDetail(prisma, params.id, range);
  if (!campaign) return failure('Campaign not found', 404);
  return success(campaign);
}
