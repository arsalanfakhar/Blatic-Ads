import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { success, unauthorized, failure } from '@/lib/api';
import { z } from 'zod';

const ConnectSchema = z.object({
  storeDomain: z.string().min(1),
  accessToken: z.string().min(1),
  shopName: z.string().optional(),
  currency: z.string().default('PKR'),
});

const DisconnectSchema = z.object({ id: z.string().min(1) });

const safeSelect = {
  id: true,
  storeDomain: true,
  shopName: true,
  currency: true,
  isActive: true,
  lastSyncAt: true,
  createdAt: true,
} as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const connections = await prisma.shopifyConnection.findMany({
    select: safeSelect,
    orderBy: { createdAt: 'desc' },
  });

  return success(connections);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const parsed = ConnectSchema.safeParse(body);
  if (!parsed.success) return failure('Invalid connection data', 400);

  const connection = await prisma.shopifyConnection.upsert({
    where: { storeDomain: parsed.data.storeDomain },
    create: parsed.data,
    update: {
      accessToken: parsed.data.accessToken,
      shopName: parsed.data.shopName,
      currency: parsed.data.currency,
    },
    select: safeSelect,
  });

  return success(connection);
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const parsed = DisconnectSchema.safeParse(body);
  if (!parsed.success) return failure('Invalid request', 400);

  await prisma.shopifyConnection.delete({ where: { id: parsed.data.id } });
  return success({ deleted: true });
}
