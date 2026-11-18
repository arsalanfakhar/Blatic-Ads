import { PrismaClient, SyncSource, SyncStatus } from '@prisma/client';
import { shopifyFetchPaginated, isShopifyConfigured } from '@/lib/shopifyClient';

interface ShopifyOrderRaw {
  id: number;
  name: string;
  total_price: string;
  subtotal_price: string;
  total_discounts: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  created_at: string;
  updated_at: string;
  refunds?: Array<{
    refund_line_items: Array<{ subtotal: number }>;
  }>;
}

interface ShopifySyncResult {
  orders: number;
  durationMs: number;
  error?: string;
}

function calcTotalRefunded(order: ShopifyOrderRaw): number {
  if (!order.refunds) return 0;
  return order.refunds.reduce(
    (sum, r) => sum + r.refund_line_items.reduce((s, li) => s + li.subtotal, 0),
    0
  );
}

export async function runShopifyOrderSync(
  prisma: PrismaClient,
  options: { fullSync?: boolean } = {}
): Promise<ShopifySyncResult> {
  const start = Date.now();

  if (!isShopifyConfigured()) {
    throw new Error('Shopify is not configured');
  }

  const syncRun = await prisma.syncRun.create({
    data: { source: SyncSource.SHOPIFY, status: SyncStatus.RUNNING },
  });

  const connection = await prisma.shopifyConnection.findFirst({
    select: { id: true },
  });
  if (!connection) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: SyncStatus.FAILED,
        finishedAt: new Date(),
        error: 'No Shopify connection found in DB',
      },
    });
    throw new Error('No Shopify connection found in DB');
  }

  const sinceDaysAgo = options.fullSync ? 90 : 3;
  const since = new Date();
  since.setDate(since.getDate() - sinceDaysAgo);

  try {
    const orders = await shopifyFetchPaginated<ShopifyOrderRaw>(
      '/admin/api/2024-01/orders.json',
      {
        status: 'any',
        updated_at_min: since.toISOString(),
        fields:
          'id,name,total_price,subtotal_price,total_discounts,currency,financial_status,fulfillment_status,created_at,updated_at,refunds',
      }
    );

    if (orders.length > 0) {
      const upserts = orders.map((o) =>
        prisma.shopifyOrder.upsert({
          where: { shopifyOrderId: String(o.id) },
          create: {
            shopifyOrderId: String(o.id),
            connectionId: connection.id,
            orderNumber: o.name,
            totalPrice: parseFloat(o.total_price),
            subtotalPrice: parseFloat(o.subtotal_price),
            totalDiscounts: parseFloat(o.total_discounts),
            totalRefunded: calcTotalRefunded(o),
            currency: o.currency,
            financialStatus: o.financial_status,
            fulfillmentStatus: o.fulfillment_status,
            orderDate: new Date(o.created_at),
          },
          update: {
            orderNumber: o.name,
            totalPrice: parseFloat(o.total_price),
            subtotalPrice: parseFloat(o.subtotal_price),
            totalDiscounts: parseFloat(o.total_discounts),
            totalRefunded: calcTotalRefunded(o),
            currency: o.currency,
            financialStatus: o.financial_status,
            fulfillmentStatus: o.fulfillment_status,
          },
        })
      );

      const BATCH_SIZE = 50;
      for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
        await prisma.$transaction(upserts.slice(i, i + BATCH_SIZE));
      }
    }

    const durationMs = Date.now() - start;

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: SyncStatus.SUCCESS,
        finishedAt: new Date(),
        itemCount: orders.length,
      },
    });

    await prisma.shopifyConnection.updateMany({
      data: { lastSyncAt: new Date() },
    });

    return { orders: orders.length, durationMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: SyncStatus.FAILED,
        finishedAt: new Date(),
        error: message,
      },
    });

    throw err;
  }
}
