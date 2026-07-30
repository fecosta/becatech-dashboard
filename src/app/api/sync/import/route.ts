// Service-to-service sync endpoint for the Google Sheets → dashboard pipeline. Called by the
// Apps Script bound to the program's master sheet (see apps-script/), not by a logged-in user.
// Runs the same parse → adapt → validate → commit → recompute pipeline as the admin import
// panel, auto-committing valid rows and logging invalid rows — no human "confirm" step.
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { DataImportEntity } from "@/generated/prisma/enums";
import { commitImportBatch, createImportBatch } from "@/lib/data-import/service";
import type { ImportEntity } from "@/lib/data-import/types";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fixed system AppUser (see prisma/seed-users.ts / prisma/seed.ts) so sync-created batches are
// auditable and distinguishable from manual admin uploads via DataImportBatch.uploadedBy.
const SYNC_USER_EMAIL = "sheets-sync@becatech.internal";

function isAuthorized(req: Request): boolean {
  const expected = process.env.SHEETS_SYNC_API_KEY;
  const provided = req.headers.get("x-api-key");
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return NextResponse.json({ error: "Could not read request body" }, { status: 400 });
  }
  if (!text.trim()) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  // TEMP diagnostic — remove once the total:0 sync issue is resolved. Header line + counts only,
  // no data rows, so this never logs scholar data.
  {
    const firstNewline = text.indexOf("\n");
    console.log(
      `[sync-debug] entity=${req.headers.get("x-entity")} textLength=${text.length} lineCount=${text.split("\n").length} header=${JSON.stringify(text.slice(0, firstNewline === -1 ? 300 : Math.min(firstNewline, 300)))}`,
    );
  }

  const uploadedById = (
    await prisma.appUser.findUnique({ where: { email: SYNC_USER_EMAIL }, select: { id: true } })
  )?.id;
  if (!uploadedById) {
    return NextResponse.json(
      { error: `Sync system user not seeded (${SYNC_USER_EMAIL})` },
      { status: 500 },
    );
  }

  const sheetName = req.headers.get("x-sheet-name")?.trim();
  const filename = sheetName ? `${sheetName}.csv` : `sheets-sync-${Date.now()}.csv`;

  // Optional x-entity header: when present, the caller (Apps Script, post-normalization) is
  // sending a clean, canonical-header CSV for exactly one entity — use the simpler, already-built
  // TEMPLATE adapter instead of the wide-format one. Absent (e.g. a raw tab posted directly,
  // without normalization) falls back to the original self-detecting LEGACY_WIDE_EXCEL behavior.
  const entityHeader = req.headers.get("x-entity")?.trim();
  if (entityHeader && !Object.values(DataImportEntity).includes(entityHeader as DataImportEntity)) {
    return NextResponse.json({ error: `Invalid x-entity: ${entityHeader}` }, { status: 400 });
  }
  const entity = entityHeader as ImportEntity | undefined;

  try {
    // Without x-entity: every raw tab (SCHOLAR GENERAL INFO / MENTOR REPORTS /
    // SUPPORT ACTIVITY LOG) self-detects from its own header shape — the caller never needs to
    // say which one this is. `entities: []` / `totalRows: 0` isn't necessarily an error: a
    // correctly-detected tab with no data rows yet (e.g. no mentor sessions logged this month)
    // looks identical at this level to an unrecognized format, so it's reported as a normal (if
    // uneventful) success rather than guessed at — same as the admin manual-upload path already
    // does for an empty upload.
    const { batchId, result } = await createImportBatch({
      data: Buffer.from(text, "utf-8"),
      filename,
      sourceType: entity ? "TEMPLATE" : "LEGACY_WIDE_EXCEL",
      entity,
      uploadedById,
    });

    await commitImportBatch(batchId);

    return NextResponse.json({
      batchId,
      committed: true,
      entities: result.entities,
      totalRows: result.totalRows,
      successRows: result.successRows,
      errorRows: result.errorRows,
      errors: result.errors.slice(0, 1000),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 422 },
    );
  }
}
