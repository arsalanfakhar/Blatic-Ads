import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { success, failure, unauthorized } from '@/lib/api';
import { runMetaSync } from '@/services/meta/syncOrchestrator';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json().catch(() => ({}));
    const result = await runMetaSync(prisma, { fullSync: body.fullSync === true });
    return success(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure(message, 500);
  }
}
