import Link from "next/link";
import { ScholarProfileView } from "@/components/ScholarProfileView";
import { ScholarSearch } from "@/components/ScholarSearch";
import { AccessDenied, Badge, Card, PageHeader, RiskBadge } from "@/components/ui";
import { canAccessScholar, type CurrentUser, Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, preserveParams, type SearchParams } from "@/lib/dashboard/filters";
import { getScholarDirectory } from "@/lib/dashboard/queries";
import type { DashboardFilters, ScholarDirectoryRow } from "@/lib/dashboard/types";
import type { ProgramStatus } from "@/generated/prisma/enums";
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
        subtitle="Who is this scholar, and how are they doing? Search any scholar to see their full record."
      />
      <ScholarSearch />

      {!q ? (
        <Card className="mt-4">
          <p className="text-sm text-muted">Search for a scholar to view their record.</p>
        </Card>
      ) : (
        <ScholarResults q={q} filters={filters} sp={sp} user={user!} />
      )}
    </div>
  );
}

async function ScholarResults({
  q,
  filters,
  sp,
  user,
}: {
  q: string;
  filters: DashboardFilters;
  sp: SearchParams;
  user: CurrentUser;
}) {
  const results = await getScholarDirectory(filters, q);

  if (results.length === 0) {
    return (
      <Card className="mt-4">
        <p className="text-sm text-muted">No scholars found matching &quot;{q}&quot;.</p>
      </Card>
    );
  }

  if (results.length === 1) {
    const scholarId = results[0].scholarId;
    if (!canAccessScholar(user, scholarId)) {
      return <AccessDenied message="You don't have access to this scholar." />;
    }
    return <ScholarProfileView scholarId={scholarId} />;
  }

  return (
    <Card className="mt-4">
      <p className="mb-3 text-xs text-muted">
        {results.length} scholars match &quot;{q}&quot; — pick one:
      </p>
      <div className="divide-y divide-border">
        {results.map((r: ScholarDirectoryRow) => (
          <Link
            key={r.scholarId}
            href={`?${preserveParams(sp, { q: r.scholarId })}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-3 hover:bg-chip-cream"
          >
            <div>
              <span className="font-medium text-purple">{r.fullName}</span>
              <span className="ml-1.5 text-xs text-muted">{r.scholarId}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
              <span>{r.university}</span>
              <span>{r.cohort}</span>
              <span>{COUNTRY_LABEL[r.country]}</span>
              <Badge tone={STATUS_TONE[r.programStatus]}>{PROGRAM_STATUS_LABEL[r.programStatus]}</Badge>
              {r.currentRiskLevel ? <RiskBadge level={r.currentRiskLevel} /> : null}
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
