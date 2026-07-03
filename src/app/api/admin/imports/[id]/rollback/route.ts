import { NextResponse } from "next/server";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { rollbackImportBatch } from "@/lib/data-import/service";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { allowed } = await requirePermission(Permission.MANAGE_IMPORTS);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  try {
    const { deleted } = await rollbackImportBatch(id);
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 422 },
    );
  }
}
