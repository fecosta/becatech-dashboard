import { BulletTrackGoal } from "@/components/BulletTrackGoal";
import { FactStrip } from "@/components/FactStrip";
import { PaceBarChart } from "@/components/PaceBarChart";
import { AccessDenied, Card, PageHeader, ProxyBadge, SectionTitle, StatChip } from "@/components/ui";
import { SectionNav } from "@/components/SectionNav";
import { gpaSummaryKpi } from "@/lib/academic/gpa-summary";
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

// Goal shape only for the MAKERS module metrics — the module tag and the goal
// threshold, both from the design. The actual values are genuinely undefined pending
// the professional-development team, so every row renders pending and none is invented.
// Verified at source: the MAKERS and CONFIDENT ENGLISH columns on the scholar sheet are
// entirely empty, so there is nothing to read even if we wanted to.
const SKILLS_METRICS = [
  { tag: "D1", label: "Assignment completion", goalLabel: "goal ≥80%" },
  { tag: "D1", label: "Entrepreneurial mindset score", goalLabel: "goal ≥70%" },
  { tag: "D2", label: "AI tools mastered", goalLabel: "goal ≥60%" },
  { tag: "D3", label: "Business model + MVP", goalLabel: "goal ≥65%" },
  { tag: "D4", label: "Validations + paying user", goalLabel: "goal ≥50%" },
  { tag: "D5", label: "High-level connections", goalLabel: "goal ≥6" },
  { tag: "D5", label: "Social capital score", goalLabel: "goal ≥65%" },
  { tag: "D6", label: "Soft skills score", goalLabel: "goal ≥7.0/10" },
] as const;

// The two skills breakdowns the design adds. Same story as the metrics above: the
// dimensions are known, the data is not.
const SKILL_DIMENSIONS = "Mindset, Social Capital, Attendance, Advanced AI and Leadership";

export default async function CareerReadinessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Growth & Development" tag="Years 3–5" />
        <AccessDenied />
      </div>
    );
  }

  // Years 3–5 band derived from currentSemester (documented default — see program-stage.ts).
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const stageFilters = { ...filters, programStage: "YEARS_3_5" as const };
  const [pace, stageOverview, overallOverview, home, support] = await Promise.all([
    getAcademicProgress(stageFilters, user),
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
  // Country-aware GPA header (Colombia /5, Peru /20, or a scale-agnostic index for a mixed scope).
  const gpaKpi = gpaSummaryKpi(pace.gpaSummary);
  const gpaTotal = gpaDist.below3_5 + gpaDist.from3_5To3_9 + gpaDist.from4_0To5_0;
  const gpaPct = (n: number) => (gpaTotal ? Math.round((n / gpaTotal) * 100) : 0);

  return (
    <div>
      <PageHeader
        title="Growth &amp; Development — Professional Skills"
        tag="Years 3–5"
        subtitle="At this stage, scholars gain greater agency, and support shifts toward building professional skills — an entrepreneurial mindset, growing meaningful professional networks, and strengthening confidence in using English in the workplace."
      />

      <FactStrip
        items={[
          {
            value: fmtInt(stageOverview.activeScholars),
            label: (
              <>
                Total scholars <span className="opacity-70">({fmtPct(stagePct)} of all active)</span>
              </>
            ),
            tone: "purple",
          },
          { value: fmtPct(retention?.rate ?? 0), label: "Retention rate", tone: "green" },
        ]}
      />

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
        <SectionTitle note="— goal vs. actual (illustrative)">
          Growth &amp; Development Metrics
        </SectionTitle>
        {/* No data source exists for these yet. Rendered as an explicit pending state — never
            invented numbers. Goal shape only, per the professional-development team's own mockup. */}
        <Card>
          {SKILLS_METRICS.map((m) => (
            <BulletTrackGoal
              key={`${m.tag}-${m.label}`}
              tag={m.tag}
              label={m.label}
              goalLabel={m.goalLabel}
              pending
            />
          ))}
        </Card>
      </div>

      {/* Both breakdowns stay a pending card rather than an empty branded table: a table
          with headers and no rows implies data that does not exist anywhere. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <SectionTitle>Skills by City</SectionTitle>
          <Card className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted">
              A per-city breakdown across {SKILL_DIMENSIONS} appears once the
              professional-development team&rsquo;s data is available.
            </p>
            <ProxyBadge>PENDING</ProxyBadge>
          </Card>
        </div>
        <div>
          <SectionTitle>Skills by University</SectionTitle>
          <Card className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted">
              The same {SKILL_DIMENSIONS} breakdown per partner university, to show where
              professional-skills support needs reinforcing.
            </p>
            <ProxyBadge>PENDING</ProxyBadge>
          </Card>
        </div>
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
                {gpaKpi.label} <b className="text-sm text-surface-dark">{gpaKpi.value}</b>
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

      <SectionNav current="/dashboard/career-readiness" sp={sp} user={user} />
    </div>
  );
}
