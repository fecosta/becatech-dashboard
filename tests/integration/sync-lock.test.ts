import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { acquireSyncLock, releaseSyncLock } from "@/lib/data-import/sync-lock";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers";

const LOCK = "test-lock";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("sync lock (database-backed overlap protection)", () => {
  it("only one holder can acquire the lock at a time", async () => {
    expect(await acquireSyncLock("holder-A", LOCK)).toBe(true);
    // A second, concurrent acquirer is blocked while A holds it.
    expect(await acquireSyncLock("holder-B", LOCK)).toBe(false);
  });

  it("the lock can be re-acquired after the holder releases it", async () => {
    await acquireSyncLock("holder-A", LOCK);
    await releaseSyncLock("holder-A", LOCK);
    expect(await acquireSyncLock("holder-B", LOCK)).toBe(true);
  });

  it("releasing is a no-op for a non-holder (never steals the lock)", async () => {
    await acquireSyncLock("holder-A", LOCK);
    await releaseSyncLock("holder-B", LOCK); // B doesn't hold it
    // A still holds it, so B still can't acquire.
    expect(await acquireSyncLock("holder-B", LOCK)).toBe(false);
  });

  it("an expired lock (TTL elapsed) is reclaimable by a new holder — self-healing", async () => {
    // Acquire with a 0ms TTL so it is already expired, simulating a crashed holder.
    expect(await acquireSyncLock("holder-A", LOCK, 0)).toBe(true);
    expect(await acquireSyncLock("holder-B", LOCK)).toBe(true);
  });

  it("concurrent acquire attempts resolve to exactly one winner", async () => {
    const results = await Promise.all([
      acquireSyncLock("A", LOCK),
      acquireSyncLock("B", LOCK),
      acquireSyncLock("C", LOCK),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
