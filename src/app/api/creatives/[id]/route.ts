import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { success, unauthorized, failure } from '@/lib/api';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const creative = await prisma.metaCreative.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      metaCreativeId: true,
      name: true,
      title: true,
      body: true,
      imageUrl: true,
      thumbnailUrl: true,
      videoUrl: true,
      tags: { select: { id: true, tag: true } },
    },
  });

  if (!creative) return failure('Creative not found', 404);
  return success(creative);
}
