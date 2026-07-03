import { NextResponse } from "next/server";
import { DataImportEntity } from "@/generated/prisma/enums";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { generateTemplate } from "@/lib/data-import/template-file";
import type { ImportEntity } from "@/lib/data-import/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { allowed } = await requirePermission(Permission.VIEW_IMPORTS);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { entity } = await ctx.params;
  if (!Object.values(DataImportEntity).includes(entity as DataImportEntity)) {
    return NextResponse.json({ error: "entity inválido" }, { status: 404 });
  }

  const buffer = generateTemplate(entity as ImportEntity);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template-${entity}.xlsx"`,
    },
  });
}
