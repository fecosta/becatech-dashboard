import Link from "next/link";
import { type Column, DataTable } from "@/components/DataTable";
import { ScholarProfileView } from "@/components/ScholarProfileView";
import { ScholarSearch } from "@/components/ScholarSearch";
import { ExecTable, type ExecRow } from "@/components/ExecTable";
import { AccessDenied, Badge, Card, PageHeader, RiskBadge, SectionTitle } from "@/components/ui";
import { SectionNav } from "@/components/SectionNav";
import { canAccessScholar, type CurrentUser, Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, preserveParams, type SearchParams } from "@/lib/dashboard/filters";
import { getContactPriority, getScholarDirectory } from "@/lib/dashboard/queries";
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
        <PageHeader title="Scholar Profile" tag="Individual record" />
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
        title="Scholar Profile"
        tag="Individual record"
        subtitle="Who is this scholar, and how are they doing? Search any scholar, or browse the full list below."
      />

      <SectionTitle size="lg" id="profile-sec-1">
        1 · Contact Prioritisation
      </SectionTitle>
      <p className="mb-3.5 text-sm text-muted">
        Scholars at medium risk or above, highest risk first, with how to reach them.
      </p>
      <ContactPriority filters={filters} sp={sp} user={user!} />

      <SectionTitle size="lg" id="profile-sec-2">
        2 · Find a Scholar
      </SectionTitle>
      <p className="mb-3.5 text-sm text-muted">
        Search by name, ID or university. The ID is the scholar&rsquo;s national identity number.
      </p>
      <ScholarSearch />
      <ScholarResults q={q} filters={filters} sp={sp} user={user!} />

      <SectionNav current="/dashboard/scholars" sp={sp} user={user} />
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
  const results = await getScholarDirectory(filters, q, user);

  if (results.length === 1) {
    const scholarId = results[0].scholarId;
    if (!canAccessScholar(user, scholarId)) {
      return <AccessDenied message="You don't have access to this scholar." />;
    }
    return <ScholarProfileView scholarId={scholarId} user={user} />;
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

/**
 * Contact list for the scholars who need reaching first.
 *
 * Access-scoped like every other scholar read — this is the only view that shows
 * personal email addresses and phone numbers, so an out-of-scope row here would be a
 * genuine leak rather than a cosmetic bug.
 */
async function ContactPriority({
  filters,
  sp,
  user,
}: {
  filters: DashboardFilters;
  sp: SearchParams;
  user: CurrentUser;
}) {
  const rows = await getContactPriority(filters, user);
  return (
    <Card>
      <ExecTable
        headers={["Scholar", "Email", "Mobile", "University", "Cohort", "Risk"]}
        rows={rows.map<ExecRow>((r) => ({
          key: r.scholarId,
          label: (
            <Link
              href={`/dashboard/scholars?${preserveParams(sp, { q: r.scholarId })}`}
              className="underline-offset-2 hover:underline"
            >
              {r.fullName}
            </Link>
          ),
          cells: [
            r.email ?? <span className="text-muted">—</span>,
            r.mobilePhone ?? <span className="text-muted">—</span>,
            r.university,
            r.cohort,
            <RiskBadge key="risk" level={r.riskLevel} />,
          ],
        }))}
        empty="No scholars at medium risk or above in this selection."
        caption="Combine the filters above to narrow down who to contact first."
      />
    </Card>
  );
}
