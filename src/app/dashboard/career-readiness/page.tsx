import {
  AccessDenied,
  Card,
  KpiCard,
  PageHeader,
  ProxyBadge,
  SectionTitle,
  StatChip,
} from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { getAcademicProgress, getSupportParticipation } from "@/lib/dashboard/queries";
import { fmtInt, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CareerReadinessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Career Readiness" tag="Years 3–5" />
        <AccessDenied />
      </div>
    );
  }

  // Years 3–5 band derived from currentSemester (documented default — see program-stage.ts).
  const filters = { ...parseFilters(await searchParams), programStage: "YEARS_3_5" as const };
  const [pace, support] = await Promise.all([
    getAcademicProgress(filters),
    getSupportParticipation(filters),
  ]);

  const onTrack = pace.progressStatusDistribution.ON_TRACK;
  const behind =
    pace.progressStatusDistribution.SLIGHTLY_BEHIND +
    pace.progressStatusDistribution.BEHIND +
    pace.progressStatusDistribution.CRITICAL_DELAY;

  return (
    <div>
      <PageHeader
        title="Career Readiness — Professional Development"
        tag="Years 3–5"
        subtitle="Are scholars ready for the workforce? Progress and professional-skills outcomes for scholars in the later years of the program."
      />

      <SectionTitle>Progress vs. Expected Pace</SectionTitle>
      <Card>
        <div className="flex flex-wrap gap-4">
          <StatChip value={fmtInt(onTrack)} label="On track" />
          <StatChip value={fmtInt(behind)} label="Need to catch up" />
          <StatChip
            value={fmtPct(support.participationRate)}
            label="Participate in program activities"
          />
        </div>
      </Card>

      <div className="mt-6">
        <SectionTitle>
          Professional Skills KPIs{" "}
          <span className="ml-1 font-normal normal-case tracking-normal text-muted">
            (illustrative — to confirm with the professional-development team)
          </span>
        </SectionTitle>
        {/* No data source exists for these yet. Rendered as an explicit pending state — never
            invented numbers (see redesign plan §7 / prohibitions §8). */}
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Employability Skills Score"
            value="—"
            badge={<ProxyBadge>PENDING</ProxyBadge>}
            sub="No data source yet — definition owned by the professional-development team"
          />
          <KpiCard
            label="Internship / Placement Rate"
            value="—"
            badge={<ProxyBadge>PENDING</ProxyBadge>}
            sub="No data source yet — definition owned by the professional-development team"
          />
          <KpiCard
            label="Workshops Completed"
            value="—"
            badge={<ProxyBadge>PENDING</ProxyBadge>}
            sub="No data source yet — definition owned by the professional-development team"
          />
        </div>
      </div>
    </div>
  );
}
