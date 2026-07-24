import { BulletTrackGoal } from "@/components/BulletTrackGoal";
import { PaceBarChart } from "@/components/PaceBarChart";
import { AccessDenied, Card, PageHeader, SectionTitle, StatChip } from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import {
  getAcademicProgress,
  getExecutiveOverview,
  getHomeOverview,
  getSupportParticipation,
} from "@/lib/dashboard/queries";
import { fmtInt, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

// Illustrative goal shape for the 6 Professional Skills metrics — names and goal
// thresholds only (per the mockup); actual values are genuinely undefined pending the
// professional-development team, so they always render pending (never fabricated).
const SKILLS_METRICS = [
  { label: "Mindset", goalLabel: "goal ≥70%" },
  { label: "Social Capital", goalLabel: "goal ≥65%" },
  { label: "Attendance Rate", goalLabel: "goal ≥80%" },
  { label: "Module D2 – Advanced AI", goalLabel: "goal ≥60%" },
  { label: "Average Connections", goalLabel: "goal ≥6" },
  { label: "Average Leadership Score", goalLabel: "goal ≥7.0/10" },
] as const;

export default async function CareerReadinessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Growth & Development" tag="Years 3–5" />
        <AccessDenied />
      </div>
    );
  }

  // Years 3–5 band derived from currentSemester (documented default — see program-stage.ts).
  const filters = parseFilters(await searchParams);
  const stageFilters = { ...filters, programStage: "YEARS_3_5" as const };
  const [pace, stageOverview, overallOverview, home, support] = await Promise.all([
    getAcademicProgress(stageFilters),
    getExecutiveOverview(stageFilters),
    getExecutiveOverview(filters),
    getHomeOverview(stageFilters),
    getSupportParticipation(stageFilters),
  ]);

  const onTrack = pace.progressStatusDistribution.ON_TRACK;
  const behind = pace.progressStatusDistribution.SLIGHTLY_BEHIND + pace.progressStatusDistribution.BEHIND;
  const critical = pace.progressStatusDistribution.CRITICAL_DELAY;
  const progressTotal = onTrack + behind + critical;
  const progressPct = (n: number) => (progressTotal ? Math.round((n / progressTotal) * 100) : 0);

  const stagePct = overallOverview.activeScholars
    ? stageOverview.activeScholars / overallOverview.activeScholars
    : 0;
  const retention = home.retentionByYear.find((r) => r.year === 3);

  const gpaDist = pace.gpaDistribution;
  const gpaTotal = gpaDist.below3_5 + gpaDist.from3_5To3_9 + gpaDist.from4_0To5_0;
  const gpaPct = (n: number) => (gpaTotal ? Math.round((n / gpaTotal) * 100) : 0);

  return (
    <div>
      <PageHeader
        title="Growth &amp; Development — Professional Skills"
        tag="Years 3–5"
        subtitle="At this stage, scholars gain greater agency, and support shifts toward building professional skills — an entrepreneurial mindset, growing meaningful professional networks, and strengthening confidence in using English in the workplace."
      />

      <div className="flex divide-x divide-border overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex-1 px-2.5 py-[18px] text-center">
          <div className="text-2xl font-extrabold text-purple">
            {fmtInt(stageOverview.activeScholars)}
          </div>
          <div className="mt-1 text-[11.5px] text-muted">
            Total scholars <span className="opacity-70">({fmtPct(stagePct)} of all active)</span>
          </div>
        </div>
        <div className="flex-1 px-2.5 py-[18px] text-center">
          <div className="text-2xl font-extrabold text-green">{fmtPct(retention?.rate ?? 0)}</div>
          <div className="mt-1 text-[11.5px] text-muted">Retention rate</div>
        </div>
      </div>

      <div className="mt-6">
        <SectionTitle>MAKERS Beca Tech Program</SectionTitle>
        <Card>
          <p className="text-[13.5px] leading-relaxed text-muted">
            A two-year program of virtual sessions, mentorships, and workshops that builds the
            professional and entrepreneurial skills scholars need for the transition into the
            workforce.
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle>
          Growth &amp; Development Metrics{" "}
          <span className="font-normal normal-case tracking-normal text-muted">
            — goal vs. actual (illustrative)
          </span>
        </SectionTitle>
        {/* No data source exists for these yet. Rendered as an explicit pending state — never
            invented numbers. Goal shape only, per the professional-development team's own mockup. */}
        <Card>
          {SKILLS_METRICS.map((m) => (
            <BulletTrackGoal key={m.label} label={m.label} goalLabel={m.goalLabel} pending />
          ))}
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle>Academic Progress</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-1.5 text-[13.5px] font-bold text-surface-dark">On track vs. behind</div>
            <div className="mb-3">
              <StatChip
                value={fmtPct(support.participationRate)}
                label="Participate in program activities"
              />
            </div>
            <PaceBarChart
              data={[
                {
                  label: "On track",
                  note: "Following their study plan",
                  valueLabel: `${progressPct(onTrack)}%`,
                  heightPct: progressPct(onTrack),
                  color: "#27cf77",
                },
                {
                  label: "Behind",
                  note: "One course behind",
                  valueLabel: `${progressPct(behind)}%`,
                  heightPct: progressPct(behind),
                  color: "#8fe0b4",
                },
                {
                  label: "Critical",
                  note: "More than one course behind",
                  valueLabel: `${progressPct(critical)}%`,
                  heightPct: progressPct(critical),
                  color: "#a62bff",
                },
              ]}
            />
          </Card>
          <Card>
            <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-1.5">
              <div className="text-[13.5px] font-bold text-surface-dark">GPA distribution</div>
              <div className="text-xs text-muted">
                Average <b className="text-sm text-surface-dark">{pace.averageGpa.toFixed(1)}/5</b>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <StatChip value={`${gpaPct(gpaDist.below3_5)}%`} label="Below 3.5" />
              <StatChip value={`${gpaPct(gpaDist.from3_5To3_9)}%`} label="GPA 3.5 – 3.9" />
              <StatChip value={`${gpaPct(gpaDist.from4_0To5_0)}%`} label="GPA 4.0 – 5.0" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
