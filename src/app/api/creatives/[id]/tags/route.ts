import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { success, unauthorized, failure } from '@/lib/api';
import { z } from 'zod';

const TagSchema = z.object({ tag: z.string().min(1).max(50) });

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const parsed = TagSchema.safeParse(body);
  if (!parsed.success) return failure('Invalid tag', 400);

  const creative = await prisma.metaCreative.findUnique({ where: { id: params.id } });
  if (!creative) return failure('Creative not found', 404);

  const tag = await prisma.metaCreativeTag.upsert({
    where: { creativeId_tag: { creativeId: params.id, tag: parsed.data.tag } },
    create: { creativeId: params.id, tag: parsed.data.tag },
    update: {},
  });

  return success(tag);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const parsed = TagSchema.safeParse(body);
  if (!parsed.success) return failure('Invalid tag', 400);

  await prisma.metaCreativeTag.deleteMany({
    where: { creativeId: params.id, tag: parsed.data.tag },
  });

  return success({ deleted: true });
}
