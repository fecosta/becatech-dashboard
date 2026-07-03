import { NextResponse } from "next/server";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { getImportBatchDetail } from "@/lib/data-import/service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { allowed } = await requirePermission(Permission.VIEW_IMPORTS);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const batch = await getImportBatchDetail(id);
  if (!batch) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ batch });
}
