import { BarCard } from "@/components/charts";
import { Column, DataTable } from "@/components/DataTable";
import { AccessDenied, Badge, KpiCard, PageHeader } from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { getSelectionPipeline } from "@/lib/dashboard/queries";
import type { SelectionCandidateRow } from "@/lib/dashboard/types";
import { fmtDate, fmtInt, fmtPct } from "@/lib/format";
import { COUNTRY_LABEL, SELECTION_STAGE_LABEL } from "@/lib/labels";

export default async function SelectionPipelinePage() {
  const { allowed } = await requirePermission(Permission.VIEW_SELECTION_PIPELINE);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Selection Pipeline" />
        <AccessDenied />
      </div>
    );
  }

  const p = await getSelectionPipeline();

  const byStage = p.byStage.map((s) => ({ name: SELECTION_STAGE_LABEL[s.stage], value: s.count }));
  const byCountry = p.byCountry.map((c) => ({ name: COUNTRY_LABEL[c.country], value: c.count }));

  const columns: Column<SelectionCandidateRow>[] = [
    { header: "Candidate", cell: (c) => <span className="font-medium text-slate-800">{c.fullName}</span> },
    { header: "Country", cell: (c) => COUNTRY_LABEL[c.country] },
    { header: "Cohort", cell: (c) => c.cohort ?? "—" },
    { header: "University", cell: (c) => c.university ?? "—" },
    { header: "Stage", cell: (c) => <Badge>{SELECTION_STAGE_LABEL[c.currentStage]}</Badge> },
    { header: "Score", cell: (c) => c.selectionScore ?? "—" },
    { header: "Application", cell: (c) => fmtDate(c.applicationDate) },
  ];

  return (
    <div>
      <PageHeader title="Selection Pipeline" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Candidates" value={fmtInt(p.total)} />
        <KpiCard label="Selected" value={fmtInt(p.selected)} />
        <KpiCard label="Conversion rate" value={fmtPct(p.conversionRate)} />
        <KpiCard label="In progress" value={fmtInt(p.inProgress)} sub={`${fmtInt(p.rejected)} rejected · ${fmtInt(p.withdrawn)} withdrawn`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <BarCard title="Candidates by stage" data={byStage} horizontal />
        <BarCard title="Candidates by country" data={byCountry} color="#0ea5e9" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-ink">Recent applications</h2>
        <DataTable columns={columns} rows={p.recent} empty="No candidates" />
      </div>
    </div>
  );
}
