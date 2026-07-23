// Reusable scholar directory (search + table) for /dashboard/scholars. Rows link to the
// scholar profile at /dashboard/scholars/[scholarId]. The caller owns the page header.
import Link from "next/link";
import { type Column, DataTable } from "@/components/DataTable";
import { ScholarSearch } from "@/components/ScholarSearch";
import { Badge, RiskBadge } from "@/components/ui";
import type { ProgramStatus } from "@/generated/prisma/enums";
import { getScholarDirectory } from "@/lib/dashboard/queries";
import type { DashboardFilters, ScholarDirectoryRow } from "@/lib/dashboard/types";
import { fmtGpa } from "@/lib/format";
import { COUNTRY_LABEL, PROGRAM_STATUS_LABEL } from "@/lib/labels";

const STATUS_TONE: Record<ProgramStatus, "green" | "red" | "amber" | "blue"> = {
  ACTIVE: "green",
  WITHDRAWN: "red",
  PAUSED: "amber",
  GRADUATED: "blue",
};

const columns: Column<ScholarDirectoryRow>[] = [
  {
    header: "Scholar",
    cell: (r) => (
      <Link
        href={`/dashboard/scholars/${r.scholarId}`}
        className="font-medium text-purple hover:underline"
      >
        {r.fullName}
        <span className="ml-1 text-xs text-muted">{r.scholarId}</span>
      </Link>
    ),
  },
  { header: "Country", cell: (r) => COUNTRY_LABEL[r.country] },
  { header: "Cohort", cell: (r) => r.cohort },
  { header: "University", cell: (r) => r.university },
  { header: "Program", cell: (r) => r.academicProgram },
  {
    header: "Status",
    cell: (r) => <Badge tone={STATUS_TONE[r.programStatus]}>{PROGRAM_STATUS_LABEL[r.programStatus]}</Badge>,
  },
  {
    header: "Risk",
    cell: (r) =>
      r.currentRiskLevel ? <RiskBadge level={r.currentRiskLevel} /> : <span className="text-muted">—</span>,
  },
  { header: "GPA", cell: (r) => fmtGpa(r.latestGpa) },
];

export async function ScholarDirectory({
  filters,
  q,
}: {
  filters: DashboardFilters;
  q?: string;
}) {
  const rows = await getScholarDirectory(filters, q);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <ScholarSearch />
        <span className="text-xs text-muted">{rows.length} scholar(s)</span>
      </div>
      <DataTable columns={columns} rows={rows} empty="No scholars found" />
    </div>
  );
}
