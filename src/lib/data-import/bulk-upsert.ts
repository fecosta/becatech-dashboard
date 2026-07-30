// Single-round-trip upsert for an entire batch of rows via native Postgres
// INSERT ... ON CONFLICT DO UPDATE, instead of one findUnique + create/update per row.
// Necessary at Google-Sheets-sync volumes (thousands of rows): the per-row approach needs one
// round trip per row (two for a miss), which blows past Prisma's interactive-transaction timeout
// long before it blows past Postgres's own limits — a multi-thousand-row upsert is routine for
// Postgres in a single statement.
import { Prisma } from "../../generated/prisma/client";

type Row = Record<string, unknown>;

// Comfortably under Postgres's 65535 bound-parameter limit even for the widest table
// (MENTOR_REPORT, ~25 columns): 500 rows * 25 cols = 12,500 params.
const CHUNK_SIZE = 500;

export interface UpsertedRow {
  id: string;
  wasInserted: boolean;
}

/**
 * Upserts `rows` into `table`, keyed on `conflictColumns` (must match a unique constraint/index).
 * `idColumn` is the primary key to RETURNING — for tables with a natural-key PK (e.g. Scholar's
 * scholarId) this is the same as (one of) the conflict columns; for cuid-PK tables it's the
 * separate `id` field, which the caller must have already generated for every row (no DB-level
 * default exists for it, unlike createdAt).
 *
 * All rows must have the exact same set of keys (guaranteed by the `build*` functions in
 * validate.ts, which assign every field unconditionally). Returns, per row, whether it was a
 * fresh insert or an update-in-place (via the `xmax = 0` trick) — callers need this to only
 * record freshly-created rows for insert-only rollback, matching the old per-row `create` vs
 * `update` branching.
 */
export async function bulkUpsert(
  tx: Prisma.TransactionClient,
  table: string,
  idColumn: string,
  conflictColumns: string[],
  rows: Row[],
): Promise<UpsertedRow[]> {
  if (rows.length === 0) return [];

  const columns = Object.keys(rows[0]);
  const updateColumns = columns.filter((c) => !conflictColumns.includes(c) && c !== idColumn);
  const columnsSql = Prisma.raw(columns.map((c) => `"${c}"`).join(", "));
  const conflictSql = Prisma.raw(conflictColumns.map((c) => `"${c}"`).join(", "));
  const updateSetSql = Prisma.raw(updateColumns.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", "));
  const idSql = Prisma.raw(`"${idColumn}"`);
  const tableSql = Prisma.raw(`"${table}"`);

  const results: UpsertedRow[] = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const valuesSql = Prisma.join(
      chunk.map((row) => Prisma.sql`(${Prisma.join(columns.map((c) => row[c] ?? null))})`),
    );
    const chunkResult = await tx.$queryRaw<UpsertedRow[]>(Prisma.sql`
      INSERT INTO ${tableSql} (${columnsSql})
      VALUES ${valuesSql}
      ON CONFLICT (${conflictSql}) DO UPDATE SET ${updateSetSql}
      RETURNING ${idSql} AS id, (xmax = 0) AS "wasInserted"
    `);
    results.push(...chunkResult);
  }
  return results;
}
