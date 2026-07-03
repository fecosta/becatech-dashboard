import Link from "next/link";
import { Column, DataTable } from "@/components/DataTable";
import { AccessDenied, Badge, Card, PageHeader } from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { listImportBatches } from "@/lib/data-import/service";
import { fmtDate } from "@/lib/format";
import {
  IMPORT_ENTITIES,
  IMPORT_ENTITY_LABEL,
  IMPORT_SOURCE_LABEL,
  IMPORT_STATUS_LABEL,
  IMPORT_STATUS_TONE,
} from "@/lib/labels";

type BatchRow = Awaited<ReturnType<typeof listImportBatches>>[number];

export default async function ImportsListPage() {
  const { allowed } = await requirePermission(Permission.VIEW_IMPORTS);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Importaciones de datos" />
        <AccessDenied message="Solo el rol Analista / Admin puede gestionar importaciones." />
      </div>
    );
  }

  const batches = await listImportBatches();

  const columns: Column<BatchRow>[] = [
    {
      header: "Archivo",
      cell: (b) => (
        <Link href={`/dashboard/admin/imports/${b.id}`} className="font-medium text-blue-700 hover:underline">
          {b.filename}
        </Link>
      ),
    },
    { header: "Origen", cell: (b) => IMPORT_SOURCE_LABEL[b.sourceType] ?? b.sourceType },
    { header: "Entidades", cell: (b) => b.entities.map((e) => IMPORT_ENTITY_LABEL[e] ?? e).join(", ") || "—" },
    {
      header: "Estado",
      cell: (b) =>
        b.rolledBackAt ? (
          <Badge tone="amber">Revertida</Badge>
        ) : (
          <Badge tone={IMPORT_STATUS_TONE[b.status] ?? "slate"}>{IMPORT_STATUS_LABEL[b.status] ?? b.status}</Badge>
        ),
    },
    { header: "Filas", cell: (b) => `${b.successRows}✓ / ${b.errorRows}✕ (${b.totalRows})` },
    { header: "Cargado por", cell: (b) => b.uploadedBy?.fullName ?? "—" },
    { header: "Fecha", cell: (b) => fmtDate(b.uploadedAt) },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Importaciones de datos" subtitle="Carga de becarios y registros longitudinales." />
        <Link
          href="/dashboard/admin/imports/new"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nueva importación
        </Link>
      </div>

      <Card className="mb-6">
        <div className="text-sm font-medium text-slate-700">Descargar plantillas</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {IMPORT_ENTITIES.map((e) => (
            <a
              key={e}
              href={`/api/admin/imports/template/${e}`}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              {IMPORT_ENTITY_LABEL[e]}
            </a>
          ))}
        </div>
      </Card>

      <DataTable columns={columns} rows={batches} empty="Aún no hay importaciones" />
    </div>
  );
}
