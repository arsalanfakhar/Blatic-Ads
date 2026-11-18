import { PrismaClient } from '@prisma/client';
import { runMetaSync } from '../services/meta/syncOrchestrator';

const prisma = new PrismaClient();

async function main() {
  const isFullSync = process.argv.includes('--full');
  console.log(`Starting ${isFullSync ? 'full' : 'incremental'} Meta sync...`);
  const result = await runMetaSync(prisma, { fullSync: isFullSync });
  console.log('Sync complete:', JSON.stringify(result, null, 2));
}

main()
  .catch(e => { console.error('Sync error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
