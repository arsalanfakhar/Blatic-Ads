import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// Each query costs a full network round trip to Supabase (~0.75s), so rows are
// written in multi-row INSERT ... ON CONFLICT statements instead of one upsert per row.
const MAX_PARAMS_PER_QUERY = 30_000;
const CONCURRENCY = 4;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface BulkUpsertOptions {
  table: string;
  conflictColumns: string[];
  columns: string[];
  rows: unknown[][];
  // Tables with Prisma-managed createdAt/updatedAt (client-side defaults, so raw SQL must set them)
  timestamps?: boolean;
}

function quote(identifier: string): string {
  if (!IDENTIFIER.test(identifier)) throw new Error(`Invalid SQL identifier: ${identifier}`);
  return `"${identifier}"`;
}

function dedupe(opts: BulkUpsertOptions): unknown[][] {
  const keyIdx = opts.conflictColumns.map((c) => opts.columns.indexOf(c));
  if (keyIdx.includes(-1)) throw new Error('conflictColumns must be listed in columns');
  const byKey = new Map<string, unknown[]>();
  for (const row of opts.rows) {
    const key = keyIdx
      .map((i) => (row[i] instanceof Date ? (row[i] as Date).toISOString() : String(row[i])))
      .join('|');
    byKey.set(key, row);
  }
  return [...byKey.values()];
}

export function buildUpsertSql(opts: BulkUpsertOptions, rows: unknown[][]): Prisma.Sql {
  const insertCols = ['id', ...opts.columns, ...(opts.timestamps ? ['createdAt', 'updatedAt'] : [])];
  const updateCols = opts.columns.filter((c) => !opts.conflictColumns.includes(c));
  const setClause = [
    ...updateCols.map((c) => `${quote(c)} = EXCLUDED.${quote(c)}`),
    ...(opts.timestamps ? [`"updatedAt" = NOW()`] : []),
  ].join(', ');

  const tuples = rows.map((row) =>
    opts.timestamps
      ? Prisma.sql`(${Prisma.join([randomUUID(), ...row])}, NOW(), NOW())`
      : Prisma.sql`(${Prisma.join([randomUUID(), ...row])})`
  );

  return Prisma.sql`INSERT INTO ${Prisma.raw(quote(opts.table))} (${Prisma.raw(insertCols.map(quote).join(', '))}) VALUES ${Prisma.join(tuples)} ON CONFLICT (${Prisma.raw(opts.conflictColumns.map(quote).join(', '))}) DO UPDATE SET ${Prisma.raw(setClause)}`;
}

export async function bulkUpsert(prisma: PrismaClient, opts: BulkUpsertOptions): Promise<number> {
  const rows = dedupe(opts);
  if (rows.length === 0) return 0;

  const chunkSize = Math.max(1, Math.floor(MAX_PARAMS_PER_QUERY / (opts.columns.length + 1)));
  const chunks: unknown[][][] = [];
  for (let i = 0; i < rows.length; i += chunkSize) chunks.push(rows.slice(i, i + chunkSize));

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    await Promise.all(
      chunks.slice(i, i + CONCURRENCY).map((chunk) => prisma.$executeRaw(buildUpsertSql(opts, chunk)))
    );
  }
  return rows.length;
}
