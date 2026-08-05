// Database-backed mutual exclusion so two imports/syncs never run concurrently against the shared
// database. In-memory locks are useless here: serverless functions scale to many instances, so the
// lock must live in the database. Uses a single atomic `INSERT ... ON CONFLICT DO UPDATE` guarded
// by an expiry check — no read-then-write race — and a bounded `expiresAt` so a crashed holder's
// lock self-heals instead of deadlocking forever.
import { prisma } from "../db";

export const SYNC_LOCK_NAME = "google-sheets-sync";

/** Default lock lifetime — comfortably longer than a normal sync, short enough that a crashed
 *  holder frees the lock in a reasonable time. */
export const SYNC_LOCK_TTL_MS = 10 * 60 * 1000;

/**
 * Try to acquire the named lock for `holder`. Returns true if acquired (no other holder, or the
 * previous holder's lock had expired), false if it is currently held by someone else. Atomic: the
 * conditional upsert either writes our row (RETURNING a row) or the WHERE clause blocks the update
 * (no row returned) — there is no window between checking and taking the lock.
 */
export async function acquireSyncLock(
  holder: string,
  name: string = SYNC_LOCK_NAME,
  ttlMs: number = SYNC_LOCK_TTL_MS,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    INSERT INTO "SyncLock" ("name", "holder", "acquiredAt", "expiresAt")
    VALUES (${name}, ${holder}, now(), now() + (${ttlMs} || ' milliseconds')::interval)
    ON CONFLICT ("name") DO UPDATE
      SET "holder" = EXCLUDED."holder",
          "acquiredAt" = EXCLUDED."acquiredAt",
          "expiresAt" = EXCLUDED."expiresAt"
      WHERE "SyncLock"."expiresAt" IS NULL OR "SyncLock"."expiresAt" < now()
    RETURNING "name"
  `;
  return rows.length > 0;
}

/**
 * Release the lock if (and only if) we still hold it. Safe to call unconditionally in a finally:
 * a no-op when another holder has since taken it (e.g. after our lock expired). Best-effort — a
 * failure to release is swallowed so it never masks the original operation's outcome.
 */
export async function releaseSyncLock(holder: string, name: string = SYNC_LOCK_NAME): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "SyncLock" SET "expiresAt" = now(), "holder" = NULL
      WHERE "name" = ${name} AND "holder" = ${holder}
    `;
  } catch {
    // best-effort; the TTL will reclaim the lock even if this fails
  }
}
