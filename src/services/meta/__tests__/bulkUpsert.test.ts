import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { bulkUpsert, buildUpsertSql } from '../bulkUpsert';

function mockPrisma() {
  return { $executeRaw: vi.fn().mockResolvedValue(1) } as unknown as PrismaClient & {
    $executeRaw: ReturnType<typeof vi.fn>;
  };
}

const base = {
  table: 'meta_campaigns',
  conflictColumns: ['metaCampaignId'],
  columns: ['metaCampaignId', 'name'],
};

describe('bulkUpsert', () => {
  it('does nothing for empty input', async () => {
    const prisma = mockPrisma();
    expect(await bulkUpsert(prisma, { ...base, rows: [] })).toBe(0);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('writes many rows in a single query', async () => {
    const prisma = mockPrisma();
    const rows = Array.from({ length: 500 }, (_, i) => [`c${i}`, `name ${i}`]);
    expect(await bulkUpsert(prisma, { ...base, rows })).toBe(500);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('splits into chunks that stay under the parameter limit', async () => {
    const prisma = mockPrisma();
    const columns = Array.from({ length: 19 }, (_, i) => `col${i}`);
    const rows = Array.from({ length: 4000 }, (_, i) => columns.map((_, c) => (c === 0 ? `k${i}` : c)));
    await bulkUpsert(prisma, {
      table: 'meta_daily_metrics',
      conflictColumns: ['col0'],
      columns,
      rows,
    });
    // 30000 params / (19 cols + id) = 1500 rows per query -> 3 queries for 4000 rows
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('keeps only the last row for a duplicated conflict key', async () => {
    const prisma = mockPrisma();
    const count = await bulkUpsert(prisma, {
      ...base,
      rows: [
        ['c1', 'old'],
        ['c1', 'new'],
        ['c2', 'other'],
      ],
    });
    expect(count).toBe(2);
    const sql = prisma.$executeRaw.mock.calls[0][0];
    expect(sql.values).toContain('new');
    expect(sql.values).not.toContain('old');
  });

  it('dedupes composite keys that include dates', async () => {
    const prisma = mockPrisma();
    const d = new Date('2026-11-06');
    const count = await bulkUpsert(prisma, {
      table: 'meta_daily_metrics',
      conflictColumns: ['date', 'adId'],
      columns: ['date', 'adId', 'spend'],
      rows: [
        [d, 'a1', 1],
        [new Date('2026-11-06'), 'a1', 2],
        [d, 'a2', 3],
      ],
    });
    expect(count).toBe(2);
  });

  it('rejects unsafe identifiers', () => {
    expect(() => buildUpsertSql({ ...base, table: 'x"; DROP TABLE users;--', rows: [] }, [['a', 'b']])).toThrow(
      /Invalid SQL identifier/
    );
  });

  it('requires conflict columns to be part of columns', async () => {
    await expect(
      bulkUpsert(mockPrisma(), { ...base, conflictColumns: ['missing'], rows: [['a', 'b']] })
    ).rejects.toThrow(/conflictColumns/);
  });
});

describe('buildUpsertSql', () => {
  it('upserts on the conflict key and refreshes updatedAt for timestamped tables', () => {
    const sql = buildUpsertSql({ ...base, timestamps: true, rows: [] }, [['c1', 'n1']]).sql;
    expect(sql).toContain('INSERT INTO "meta_campaigns"');
    expect(sql).toContain('ON CONFLICT ("metaCampaignId") DO UPDATE SET');
    expect(sql).toContain('"name" = EXCLUDED."name"');
    expect(sql).toContain('"updatedAt" = NOW()');
    expect(sql).not.toContain('"metaCampaignId" = EXCLUDED');
  });

  it('omits timestamp columns for tables without them', () => {
    const sql = buildUpsertSql(
      { table: 'meta_daily_metrics', conflictColumns: ['adId'], columns: ['adId', 'spend'], rows: [] },
      [['a1', 5]]
    ).sql;
    expect(sql).not.toContain('updatedAt');
    expect(sql).not.toContain('createdAt');
  });
});
