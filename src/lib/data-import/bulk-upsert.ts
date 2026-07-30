// Single-round-trip upsert for an entire batch of rows via native Postgres
// INSERT ... ON CONFLICT DO UPDATE, instead of one findUnique + create/update per row.
// Necessary at Google-Sheets-sync volumes (thousands of rows): the per-row approach needs one
// round trip per row (two for a miss), which blows past Prisma's interactive-transaction timeout
// long before it blows past Postgres's own limits - a multi-thousand-row upsert is routine for
// Postgres in a single statement.
import { Prisma } from "../../generated/prisma/client";

type Row = Record<string, unknown>;

// Comfortably under Postgres's 65535 bound-parameter limit even for the widest table
// (MENTOR_REPORT, ~25 columns): 500 rows * 25 cols = 12,500 params.
const CHUNK_SIZE = 500;

// A pipe is not a value any conflict column (scholarId, period, activityType/enum, source,
// term, submissionId) is expected to contain, so joining with it can't manufacture a false key
// collision between two different column-value combinations.
const KEY_SEP = "|";

export interface UpsertedRow {
  id: string;
  wasInserted: boolean;
}

/**
 * Upserts `rows` into `table`, keyed on `conflictColumns` (must match a unique constraint/index).
 * `idColumn` is the primary key to RETURNING - for tables with a natural-key PK (e.g. Scholar's
 * scholarId) this is the same as (one of) the conflict columns; for cuid-PK tables it's the
 * separate `id` field, which the caller must have already generated for every row (no DB-level
 * default exists for it, unlike createdAt).
 *
 * The `build*` functions in validate.ts assign every field unconditionally, but a row's shape can
 * still differ from row to row by the time it reaches here: `createImportBatch`/`commitImportBatch`
 * round-trip the validated batch through a Prisma `Json` column, and that serialization drops any
 * key whose value is `undefined` (unlike an explicit `null`, which survives) — so two rows built by
 * the exact same function can end up with different key sets purely because one happened to have a
 * real value for an optional field and another didn't. The column list is therefore the UNION of
 * every row's keys, not just the first row's — using only the first row's keys would silently drop
 * a later row's value for any column the first row happened to lack, for every row in the batch, not
 * just the ones missing it.
 *
 * Any column that's NOT NULL with a DB-level default (e.g. SupportActivity.activityCount) must be
 * given a real value by the caller before calling this — a per-row VALUES tuple in a multi-row
 * INSERT has no way to say "omit this column, use its default" only for some rows, so a row that
 * lacks the key gets an explicit NULL here, which violates NOT NULL instead of falling back to the
 * default the way Prisma's typed `create()` would have.
 *
 * Returns, per row, whether it was a fresh insert or an update-in-place (via the `xmax = 0` trick)
 * — callers need this to only record freshly-created rows for insert-only rollback, matching the
 * old per-row `create` vs `update` branching.
 */
export async function bulkUpsert(
  tx: Prisma.TransactionClient,
  table: string,
  idColumn: string,
  conflictColumns: string[],
  rows: Row[],
): Promise<UpsertedRow[]> {
  if (rows.length === 0) return [];

  // Postgres refuses "ON CONFLICT DO UPDATE" if the same conflict-target key appears twice
  // within one statement ("ON CONFLICT DO UPDATE command cannot affect row a second time") -
  // real sheet data occasionally has duplicate rows for the same natural key (e.g. a scholar's
  // activity logged twice for the same month). Dedupe first, keeping the last occurrence, which
  // matches what the old sequential per-row upsert did (each later row updates the same DB row
  // the previous one just wrote).
  const dedupedByKey = new Map<string, Row>();
  for (const row of rows) {
    const key = conflictColumns.map((c) => String(row[c] ?? "")).join(KEY_SEP);
    dedupedByKey.set(key, row);
  }
  const dedupedRows = [...dedupedByKey.values()];

  const columnSet = new Set<string>();
  for (const row of dedupedRows) for (const c of Object.keys(row)) columnSet.add(c);
  const columns = [...columnSet];
  const updateColumns = columns.filter((c) => !conflictColumns.includes(c) && c !== idColumn);
  const columnsSql = Prisma.raw(columns.map((c) => `"${c}"`).join(", "));
  const conflictSql = Prisma.raw(conflictColumns.map((c) => `"${c}"`).join(", "));
  const updateSetSql = Prisma.raw(updateColumns.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", "));
  const idSql = Prisma.raw(`"${idColumn}"`);
  const tableSql = Prisma.raw(`"${table}"`);

  const results: UpsertedRow[] = [];
  for (let i = 0; i < dedupedRows.length; i += CHUNK_SIZE) {
    const chunk = dedupedRows.slice(i, i + CHUNK_SIZE);
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
