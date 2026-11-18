import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { success, failure, unauthorized } from '@/lib/api';
import { runShopifyOrderSync } from '@/services/shopify/orderSync';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json().catch(() => ({}));
    const result = await runShopifyOrderSync(prisma, { fullSync: body.fullSync === true });
    return success(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure(message, 500);
  }
}
