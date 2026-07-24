import Link from "next/link";
import { type Column, DataTable } from "@/components/DataTable";
import { ScholarProfileView } from "@/components/ScholarProfileView";
import { ScholarSearch } from "@/components/ScholarSearch";
import { AccessDenied, Badge, PageHeader, RiskBadge } from "@/components/ui";
import { canAccessScholar, type CurrentUser, Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, preserveParams, type SearchParams } from "@/lib/dashboard/filters";
import { getScholarDirectory } from "@/lib/dashboard/queries";
import type { DashboardFilters, ScholarDirectoryRow } from "@/lib/dashboard/types";
import type { ProgramStatus } from "@/generated/prisma/enums";
import { fmtGpa } from "@/lib/format";
import { COUNTRY_LABEL, PROGRAM_STATUS_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<ProgramStatus, "green" | "red" | "amber" | "blue"> = {
  ACTIVE: "green",
  WITHDRAWN: "red",
  PAUSED: "amber",
  GRADUATED: "blue",
};

export default async function ScholarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Scholar Progress" tag="Individual record" />
        <AccessDenied />
      </div>
    );
  }

  const sp = await searchParams;
  const filters = parseFilters(sp);
  const qRaw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = qRaw?.trim();

  return (
    <div>
      <PageHeader
        title="Scholar Progress"
        tag="Individual record"
        subtitle="Who is this scholar, and how are they doing? Search any scholar, or browse the full list below."
      />
      <ScholarSearch />
      <ScholarResults q={q} filters={filters} sp={sp} user={user!} />
    </div>
  );
}

const columns = (sp: SearchParams): Column<ScholarDirectoryRow>[] => [
  {
    header: "Scholar",
    cell: (r) => (
      <Link href={`?${preserveParams(sp, { q: r.scholarId })}`} className="font-medium text-purple hover:underline">
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
    cell: (r) => (r.currentRiskLevel ? <RiskBadge level={r.currentRiskLevel} /> : <span className="text-muted">—</span>),
  },
  { header: "GPA", cell: (r) => fmtGpa(r.latestGpa) },
];

async function ScholarResults({
  q,
  filters,
  sp,
  user,
}: {
  q?: string;
  filters: DashboardFilters;
  sp: SearchParams;
  user: CurrentUser;
}) {
  const results = await getScholarDirectory(filters, q);

  if (results.length === 1) {
    const scholarId = results[0].scholarId;
    if (!canAccessScholar(user, scholarId)) {
      return <AccessDenied message="You don't have access to this scholar." />;
    }
    return <ScholarProfileView scholarId={scholarId} />;
  }

  return (
    <div className="mt-4">
      <div className="mb-2 text-xs text-muted">
        {results.length} scholar{results.length === 1 ? "" : "s"}
        {q ? (
          <>
            {" "}
            matching &quot;{q}&quot;
          </>
        ) : null}
      </div>
      <DataTable
        columns={columns(sp)}
        rows={results}
        empty={q ? `No scholars found matching "${q}".` : "No scholars found."}
      />
    </div>
  );
}
