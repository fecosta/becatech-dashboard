import Link from "next/link";
import { notFound } from "next/navigation";
import { RollbackButton } from "@/components/RollbackButton";
import { AccessDenied, Badge, Card, KpiCard, PageHeader, SectionTitle } from "@/components/ui";
import { canManageImports, Permission } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/guard";
import { getImportBatchDetail } from "@/lib/data-import/service";
import { fmtDate } from "@/lib/format";
import {
  IMPORT_ENTITY_LABEL,
  IMPORT_SOURCE_LABEL,
  IMPORT_STATUS_LABEL,
  IMPORT_STATUS_TONE,
} from "@/lib/labels";

interface StoredError {
  entity?: string;
  rowNumber?: number;
  field?: string;
  message?: string;
}

export default async function ImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { allowed } = await requirePermission(Permission.VIEW_IMPORTS);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Detalle de importación" />
        <AccessDenied message="Solo el rol Analista / Admin puede gestionar importaciones." />
      </div>
    );
  }

  const { id } = await params;
  const batch = await getImportBatchDetail(id);
  if (!batch) notFound();

  const user = await getCurrentUser();
  const canRollback =
    (!user || canManageImports(user)) && batch.status === "COMMITTED" && !batch.rolledBackAt;
  const errors = Array.isArray(batch.errorReport) ? (batch.errorReport as StoredError[]) : [];

  return (
    <div>
      <Link href="/dashboard/admin/imports" className="text-xs text-slate-500 hover:underline">
        ← Volver a importaciones
      </Link>
      <PageHeader title={batch.filename} subtitle={`Cargado por ${batch.uploadedBy?.fullName ?? "—"} · ${fmtDate(batch.uploadedAt)}`} />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone="blue">{IMPORT_SOURCE_LABEL[batch.sourceType] ?? batch.sourceType}</Badge>
        {batch.rolledBackAt ? (
          <Badge tone="amber">Revertida</Badge>
        ) : (
          <Badge tone={IMPORT_STATUS_TONE[batch.status] ?? "slate"}>
            {IMPORT_STATUS_LABEL[batch.status] ?? batch.status}
          </Badge>
        )}
        {batch.entities.map((e) => (
          <Badge key={e}>{IMPORT_ENTITY_LABEL[e] ?? e}</Badge>
        ))}
        {batch.triggeredRiskRecompute ? <Badge tone="green">Riesgo recalculado</Badge> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Filas totales" value={batch.totalRows} />
        <KpiCard label="Aplicadas" value={batch.successRows} />
        <KpiCard label="Con error" value={batch.errorRows} />
        <KpiCard label="Estado" value={batch.rolledBackAt ? "Revertida" : IMPORT_STATUS_LABEL[batch.status] ?? batch.status} />
      </div>

      {canRollback ? (
        <div className="mt-6">
          <RollbackButton batchId={batch.id} />
          <p className="mt-1 text-xs text-slate-400">
            Elimina solo las filas creadas por este lote (las actualizaciones no se revierten).
          </p>
        </div>
      ) : null}

      <div className="mt-6">
        <SectionTitle>Errores de validación ({errors.length})</SectionTitle>
        {errors.length === 0 ? (
          <Card className="text-sm text-slate-500">Sin errores.</Card>
        ) : (
          <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2">Fila</th>
                  <th className="px-4 py-2">Entidad</th>
                  <th className="px-4 py-2">Campo</th>
                  <th className="px-4 py-2">Mensaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {errors.map((e, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">{e.rowNumber ?? "—"}</td>
                    <td className="px-4 py-2">{e.entity ? IMPORT_ENTITY_LABEL[e.entity] ?? e.entity : "—"}</td>
                    <td className="px-4 py-2">{e.field ?? "—"}</td>
                    <td className="px-4 py-2 text-red-700">{e.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
