// Find a Scholar. A static segment, so Next.js resolves it ahead of the sibling
// [scholarId] route — safe because scholarIds are national identity numbers, never the
// literal string "find".
import Link from "next/link";
import { type Column, DataTable } from "@/components/DataTable";
import { ScholarSearch } from "@/components/ScholarSearch";
import { ScholarSectionTabs } from "@/components/ScholarSectionTabs";
import { AccessDenied, Badge, PageHeader, RiskBadge, SectionTitle } from "@/components/ui";
import { SectionNav } from "@/components/SectionNav";
import { type CurrentUser, Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { getScholarDirectory } from "@/lib/dashboard/queries";
import { SCHOLAR_SECTION, scholarProfileHref } from "@/lib/dashboard/scholar-routes";
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

export default async function FindAScholarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Find a Scholar" tag="Scholar Profile" />
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
        title="Find a Scholar"
        tag="Scholar Profile"
        subtitle="Search any scholar, or browse the full list. Selecting one opens their profile in a new tab."
      />

      <ScholarSectionTabs active="find" sp={sp} />

      <SectionTitle size="lg" id="profile-sec-2">
        2 · Find a Scholar
      </SectionTitle>
      <p className="mb-3.5 text-sm text-muted">
        Search by name, ID or university. The ID is the scholar&rsquo;s national identity number.
      </p>
      <ScholarSearch />
      <ScholarResults q={q} filters={filters} sp={sp} user={user!} />

      <SectionNav current={SCHOLAR_SECTION.contact.href} sp={sp} user={user} />
    </div>
  );
}

const columns = (sp: SearchParams): Column<ScholarDirectoryRow>[] => [
  {
    header: "Scholar",
    cell: (r) => (
      <Link
        href={scholarProfileHref(r.scholarId, sp)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-purple hover:underline"
      >
        {r.fullName}
        <span className="ml-1 text-xs text-muted">{r.scholarId}</span>
        <span className="sr-only"> (opens in a new tab)</span>
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

/**
 * The match list. A single match stays a one-row table rather than swapping itself for the
 * profile: this screen has to survive the click, so the profile is always a new tab away.
 */
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
  const results = await getScholarDirectory(filters, q, user);

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
