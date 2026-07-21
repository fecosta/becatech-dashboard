import { NextResponse } from "next/server";
import { DataImportEntity, DataImportSourceType } from "@/generated/prisma/enums";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { createImportBatch, listImportBatches } from "@/lib/data-import/service";
import type { ImportEntity } from "@/lib/data-import/types";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { allowed } = await requirePermission(Permission.VIEW_IMPORTS);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ batches: await listImportBatches() });
}

export async function POST(req: Request) {
  const { user, allowed } = await requirePermission(Permission.MANAGE_IMPORTS);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File required" }, { status: 400 });
  }

  const sourceType = String(form.get("sourceType") ?? "");
  if (!Object.values(DataImportSourceType).includes(sourceType as DataImportSourceType)) {
    return NextResponse.json({ error: "Invalid sourceType" }, { status: 400 });
  }
  const entityRaw = form.get("entity") ? String(form.get("entity")) : undefined;
  if (entityRaw && !Object.values(DataImportEntity).includes(entityRaw as DataImportEntity)) {
    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  }

  const uploadedById =
    user?.id ??
    (await prisma.appUser.findFirst({ where: { role: "ANALYST_ADMIN" }, select: { id: true } }))?.id;
  if (!uploadedById) {
    return NextResponse.json({ error: "No user to attribute the upload to" }, { status: 400 });
  }

  try {
    const data = await file.arrayBuffer();
    const { batchId, result } = await createImportBatch({
      data,
      filename: file.name,
      sourceType: sourceType as DataImportSourceType,
      entity: entityRaw as ImportEntity | undefined,
      uploadedById,
    });
    return NextResponse.json({
      batchId,
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
