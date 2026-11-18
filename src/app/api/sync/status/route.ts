import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { success, unauthorized } from '@/lib/api';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const runs = await prisma.syncRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      source: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      itemCount: true,
      error: true,
    },
  });

  return success(runs);
}
