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
        <PageHeader title="Import Detail" />
        <AccessDenied message="Only the Analyst / Admin role can manage imports." />
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
      <Link href="/dashboard/admin/imports" className="text-xs text-muted hover:underline">
        ← Back to imports
      </Link>
      <PageHeader title={batch.filename} subtitle={`Uploaded by ${batch.uploadedBy?.fullName ?? "—"} · ${fmtDate(batch.uploadedAt)}`} />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone="blue">{IMPORT_SOURCE_LABEL[batch.sourceType] ?? batch.sourceType}</Badge>
        {batch.rolledBackAt ? (
          <Badge tone="amber">Rolled back</Badge>
        ) : (
          <Badge tone={IMPORT_STATUS_TONE[batch.status] ?? "slate"}>
            {IMPORT_STATUS_LABEL[batch.status] ?? batch.status}
          </Badge>
        )}
        {batch.entities.map((e) => (
          <Badge key={e}>{IMPORT_ENTITY_LABEL[e] ?? e}</Badge>
        ))}
        {batch.triggeredRiskRecompute ? <Badge tone="green">Risk recomputed</Badge> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total rows" value={batch.totalRows} />
        <KpiCard label="Applied" value={batch.successRows} />
        <KpiCard label="With errors" value={batch.errorRows} />
        <KpiCard label="Status" value={batch.rolledBackAt ? "Rolled back" : IMPORT_STATUS_LABEL[batch.status] ?? batch.status} />
      </div>

      {canRollback ? (
        <div className="mt-6">
          <RollbackButton batchId={batch.id} />
          <p className="mt-1 text-xs text-muted">
            Deletes only the rows created by this batch (updates are not rolled back).
          </p>
        </div>
      ) : null}

      <div className="mt-6">
        <SectionTitle>Validation errors ({errors.length})</SectionTitle>
        {errors.length === 0 ? (
          <Card className="text-sm text-muted">No errors.</Card>
        ) : (
          <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2">Row</th>
                  <th className="px-4 py-2">Entity</th>
                  <th className="px-4 py-2">Field</th>
                  <th className="px-4 py-2">Message</th>
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
