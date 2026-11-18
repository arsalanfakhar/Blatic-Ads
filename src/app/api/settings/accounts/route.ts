import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { success, unauthorized, failure } from '@/lib/api';
import { z } from 'zod';

const CreateAccountSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1),
  accessToken: z.string().min(1),
  currency: z.string().default('PKR'),
  timezone: z.string().default('Asia/Karachi'),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const accounts = await prisma.metaAdAccount.findMany({
    select: {
      id: true,
      accountId: true,
      name: true,
      currency: true,
      timezone: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return success(accounts);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const parsed = CreateAccountSchema.safeParse(body);
  if (!parsed.success) return failure('Invalid account data', 400);

  const account = await prisma.metaAdAccount.create({
    data: parsed.data,
    select: {
      id: true,
      accountId: true,
      name: true,
      currency: true,
      timezone: true,
      isActive: true,
      createdAt: true,
    },
  });

  return success(account);
}
