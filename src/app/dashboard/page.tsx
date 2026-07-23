import Link from "next/link";
import { BarCard, PieCard } from "@/components/charts";
import {
  AccessDenied,
  Card,
  KpiCard,
  PageHeader,
  ProxyBadge,
  SectionTitle,
} from "@/components/ui";
import type { AcademicProgressStatus } from "@/generated/prisma/enums";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import {
  getAcademicProgress,
  getExecutiveOverview,
  getHomeOverview,
  getRiskAlerts,
} from "@/lib/dashboard/queries";
import { riskChartData } from "@/lib/dashboard/view-helpers";
import { fmtGpa, fmtInt, fmtPct } from "@/lib/format";
import { PROGRESS_STATUS_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

const PROGRESS_ORDER: AcademicProgressStatus[] = [
  "ON_TRACK",
  "SLIGHTLY_BEHIND",
  "BEHIND",
  "CRITICAL_DELAY",
];
// Progress hues on the neutral risk-ish scale (green → dark). Kept legible for the pace bar.
const PROGRESS_COLORS: Record<AcademicProgressStatus, string> = {
  ON_TRACK: "#27cf77",
  SLIGHTLY_BEHIND: "#8fe0b4",
  BEHIND: "#a62bff",
  CRITICAL_DELAY: "#3a0a5c",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { allowed } = await requirePermission(Permission.VIEW_DASHBOARD);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Beca Tech+" />
        <AccessDenied />
      </div>
    );
  }

  const filters = parseFilters(await searchParams);
  const [o, home, ap, alerts] = await Promise.all([
    getExecutiveOverview(filters),
    getHomeOverview(filters),
    getAcademicProgress(filters),
    getRiskAlerts(filters),
  ]);

  const womenDisplay = home.womenPercentage == null ? "—" : fmtPct(home.womenPercentage);
  const criticalCount = alerts.attentionList.filter((r) => r.globalRiskValue >= 3).length;
  const missingReportsCount = alerts.attentionList.filter(
    (r) => r.missingCheckin || r.missingMentorReport,
  ).length;

  const progressData = PROGRESS_ORDER.map((k) => ({
    name: PROGRESS_STATUS_LABEL[k],
    value: ap.progressStatusDistribution[k],
    color: PROGRESS_COLORS[k],
  }));

  return (
    <div>
      {/* "Data as of" is derived from the latest data month (getCurrentPeriod), not a real
          sync timestamp — flagged as an open decision in the redesign plan (§7). */}
      <PageHeader title="Beca Tech+" tag={`Data as of ${o.currentPeriod}`} />

      {/* Narrative intro — the ten-second answer for a board member. */}
      <div className="mb-6">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-muted">Home</div>
        <h2 className="text-[28px] font-extrabold leading-tight text-surface-dark">
          The Program, in a Nutshell
        </h2>
        <div className="mt-1 text-[15px] font-bold text-purple">The widest view</div>
        <span className="mt-3 inline-block rounded-full bg-lavender px-4 py-2 text-[13px] font-bold text-purple">
          How is the program doing, overall?
        </span>
        <p className="mt-3 max-w-[720px] text-[14.5px] leading-relaxed text-ink">
          Total active scholars, retention, satisfaction, average GPA, and partner universities —
          filterable by cohort, country, and university. The entry point into everything else.
        </p>
      </div>

      {/* Row 1 — program health KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active Scholars" value={fmtInt(o.activeScholars)} sub={`${fmtInt(o.totalScholars)} in total`} />
        <KpiCard label="Retention" value={fmtPct(o.retentionRate)} sub={`${fmtInt(o.withdrawnScholars)} withdrawn`} />
        <KpiCard
          label="Satisfaction"
          value="—"
          badge={<ProxyBadge>PROXY</ProxyBadge>}
          sub="Well-being proxy — pending an approved formula"
        />
        <KpiCard label="Average GPA" value={fmtGpa(o.averageGpa)} sub="0–5 scale" />
      </div>

      {/* Row 2 — program composition KPIs */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Colombia / Peru"
          value={`${fmtInt(home.scholarsByCountry.colombia)} / ${fmtInt(home.scholarsByCountry.peru)}`}
          sub="Active split"
        />
        <KpiCard label="% Women" value={womenDisplay} sub="Of active scholars with recorded gender" />
        <KpiCard
          label="Latest Cohort"
          value={home.cohortSpotlight.cohort ?? "—"}
          sub={`${fmtInt(home.cohortSpotlight.count)} active scholars${filters.cohort ? "" : " (latest)"}`}
        />
        <KpiCard
          label="Partner Universities"
          value={fmtInt(home.activeUniversityCount)}
          sub={
            <span title="Not yet the official partner-university count.">With active scholars</span>
          }
        />
      </div>

      {/* Scholar journey band (orientation only — per-year metrics live on the stage pages) */}
      <div className="mt-6">
        <SectionTitle>Program Journey</SectionTitle>
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            {["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"].map((y) => (
              <span
                key={y}
                className="rounded-md bg-chip-cream px-3 py-1 text-xs font-medium text-muted"
              >
                {y}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Years 1–2: academic &amp; psychosocial support · Years 3–5: professional development
          </p>
        </Card>
      </div>

      {/* Program health band */}
      <div className="mt-6">
        <SectionTitle>Program Health</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <PieCard title="Risk distribution" data={riskChartData(o.riskDistribution)} />
          <BarCard title="Progress vs. expected pace" data={progressData} />
        </div>
      </div>

      {/* Executive attention band */}
      <div className="mt-6">
        <SectionTitle>Executive Attention</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/dashboard/early-support" className="block">
            <KpiCard label="High or critical risk" value={fmtInt(criticalCount)} sub="Scholars needing attention" />
          </Link>
          <Link href="/dashboard/early-support" className="block">
            <KpiCard label="Missing reports" value={fmtInt(missingReportsCount)} sub="Check-in or mentoring this month" />
          </Link>
          <KpiCard label="Withdrawals" value={fmtInt(o.withdrawnScholars)} sub="In the selected group" />
        </div>
      </div>
    </div>
  );
}
