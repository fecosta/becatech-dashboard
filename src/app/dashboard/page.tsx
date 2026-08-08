import Link from "next/link";
import type { ReactNode } from "react";
import { BulletTrackGoal } from "@/components/BulletTrackGoal";
import { FactStrip } from "@/components/FactStrip";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { PaceBarChart } from "@/components/PaceBarChart";
import { UniversityRetentionList } from "@/components/UniversityRetentionList";
import { AccessDenied, Card, KpiCard, PageHeader, ProxyBadge, StatChip } from "@/components/ui";
import { gpaSummaryKpi } from "@/lib/academic/gpa-summary";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import {
  getAcademicProgress,
  getDataFreshness,
  getExecutiveOverview,
  getFilterOptions,
  getHomeOverview,
  getRiskAlerts,
} from "@/lib/dashboard/queries";
import { fmtInt, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

// Program retention targets by year — documented program goals (not derived from data), used only
// for the goal marker on the retention bullet bars.
const RETENTION_GOALS: Record<1 | 2 | 3, number> = { 1: 85, 2: 90, 3: 90 };

// English levels shown in developing (purple) vs professional-working (green) proficiency.
const ENGLISH_DEVELOPING = ["A1", "A2", "B1"];

/** Big, standout section heading (mockup's `.section-title-big`) — Home-only styling. */
function BigTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3.5 mt-8 text-[21px] font-extrabold text-surface-dark first:mt-0">
      {children}
    </h2>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, allowed } = await requirePermission(Permission.VIEW_DASHBOARD);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Beca Tech+" />
        <AccessDenied />
      </div>
    );
  }

  const filters = parseFilters(await searchParams);
  const [o, home, ap, alerts, filterOptions, freshness] = await Promise.all([
    getExecutiveOverview(filters),
    getHomeOverview(filters),
    getAcademicProgress(filters, user),
    getRiskAlerts(filters, user),
    getFilterOptions(),
    getDataFreshness(new Date()),
  ]);

  // GPA is reported per country (Colombia /5, Peru /20) and, for a mixed-country scope, as a
  // scale-agnostic Academic Performance Index — never a blended raw mean (see gpa-summary.ts).
  const gpaKpi = gpaSummaryKpi(ap.gpaSummary);

  const criticalCount = alerts.attentionList.filter((r) => r.globalRiskValue >= 3).length;
  const missingReportsCount = alerts.attentionList.filter(
    (r) => r.missingCheckin || r.missingMentorReport,
  ).length;

  // Academic Progress cuadro: On track / Behind / Critical (3 buckets, per the mockup —
  // SLIGHTLY_BEHIND and BEHIND both count as "Behind", CRITICAL_DELAY is its own bucket).
  const { ON_TRACK, SLIGHTLY_BEHIND, BEHIND, CRITICAL_DELAY } = ap.progressStatusDistribution;
  const behindCount = SLIGHTLY_BEHIND + BEHIND;
  const progressTotal = ON_TRACK + behindCount + CRITICAL_DELAY;
  const progressPct = (n: number) => (progressTotal ? Math.round((n / progressTotal) * 100) : 0);

  const yearBars = [
    { key: "year1" as const, label: "Year 1" },
    { key: "year2" as const, label: "Year 2" },
    { key: "year3" as const, label: "Year 3" },
  ];
  const activeTotal =
    home.scholarsByYear.year1 + home.scholarsByYear.year2 + home.scholarsByYear.year3;

  // Dropout rate as a share of active scholars (mockup wording: "% of active scholars").
  const dropoutRate = o.activeScholars ? o.withdrawnScholars / o.activeScholars : 0;
  const sesTotal = home.socioeconomicBreakdown.reduce((n, s) => n + s.count, 0);
  const cityMax = Math.max(0, ...home.cityBreakdown.map((c) => c.count));
  const englishTotal = home.englishLevelDistribution?.reduce((n, e) => n + e.count, 0) ?? 0;
  const englishMax = Math.max(0, ...(home.englishLevelDistribution?.map((e) => e.count) ?? []));

  return (
    <div>
      {/* "Data as of {period}" is the latest data MONTH; the freshness badge below is the real
          last-sync time (last committed import/sync) plus paused/stale operational states. */}
      <PageHeader title="Beca Tech+" tag={`Data as of ${o.currentPeriod}`} />
      <div className="-mt-3 mb-5">
        <FreshnessBadge freshness={freshness} />
      </div>

      {/* Narrative intro — the ten-second answer for a board member. */}
      <div className="mb-6 rounded-[20px] border-[1.5px] border-purple bg-lavender/40 p-6">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-purple">Home</div>
        <h2 className="text-[28px] font-extrabold leading-tight text-surface-dark">
          The Program, in a Nutshell
        </h2>
        <div className="mb-3.5 mt-1 text-[15px] font-bold text-purple">The widest view</div>
        <p className="max-w-[720px] text-[15.5px] font-bold leading-snug text-surface-dark">
          We want talented young people to lead the transformation of the tech ecosystem in their
          communities.
        </p>
        <p className="mb-3.5 mt-1.5 max-w-[720px] text-sm leading-relaxed text-ink">
          Beca Tech+ is a scholarship program that supports talented, low-income students from
          Colombia and Peru in pursuing technology-related degrees.
        </p>
        <span className="mb-3.5 inline-block rounded-full border border-purple/30 bg-card px-4 py-2 text-[13px] font-bold text-purple">
          How is the program doing, overall?
        </span>
        <p className="max-w-[720px] text-[14.5px] leading-relaxed text-ink">
          Total active scholars, retention, satisfaction, average GPA, and partner universities —
          filterable by cohort, university, country, and department. The entry point into
          everything else.
        </p>
      </div>

      <FactStrip
        items={[
          { value: fmtInt(filterOptions.cohorts.length), label: "Cohorts", tone: "purple" },
          { value: fmtInt(o.totalScholars), label: "Scholars selected", tone: "green" },
          {
            value: fmtInt(home.activeUniversityCount),
            label: "Partner universities",
            tone: "purple",
          },
          {
            value: fmtInt(home.deliveryPartnerCount),
            label: "Delivery partners",
            tone: "green",
          },
        ]}
      />

      <BigTitle>How Do We Support Scholars?</BigTitle>
      <Card className="flex flex-wrap items-center justify-between gap-5">
        <p className="max-w-[440px] text-sm leading-relaxed text-muted">
          Every scholar moves through two stages of support, each with its own goals and metrics —
          explore them in detail.
        </p>
        <div className="flex flex-wrap gap-3.5">
          <Link
            href="/dashboard/early-support"
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple px-[22px] py-3 text-[13.5px] font-bold text-white hover:opacity-90"
          >
            Early Support →
          </Link>
          <Link
            href="/dashboard/career-readiness"
            className="inline-flex items-center gap-1.5 rounded-xl bg-green px-[22px] py-3 text-[13.5px] font-bold text-white hover:opacity-90"
          >
            Growth &amp; Development →
          </Link>
        </div>
      </Card>

      <BigTitle>Program Overview</BigTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cuadro 1: Total Active Scholars */}
        <Card>
          <div className="mb-3.5 text-[13.5px] font-bold text-surface-dark">
            Total Active Scholars
          </div>
          <div className="mb-3.5 text-[32px] font-extrabold text-surface-dark">
            {fmtInt(o.activeScholars)}
          </div>
          <div className="flex flex-wrap gap-4">
            <StatChip
              tone="green"
              value={fmtInt(home.scholarsByCountry.colombia)}
              label="Active in Colombia"
            />
            <StatChip
              tone="green"
              value={fmtInt(home.scholarsByCountry.peru)}
              label="Active in Peru"
            />
            <StatChip
              tone="green"
              value={fmtInt(home.genderBreakdown.female)}
              label="Active women"
            />
          </div>
        </Card>

        {/* Cuadro 2: Retention Rate */}
        <Card>
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-1.5">
            <div className="text-[13.5px] font-bold text-surface-dark">Retention Rate</div>
            <div className="text-xs text-muted">
              Program average <b className="text-sm text-surface-dark">{fmtPct(o.retentionRate)}</b>
            </div>
          </div>
          {home.retentionByYear.map((r) => (
            <BulletTrackGoal
              key={r.year}
              label={`Year ${r.year}`}
              goalLabel={`goal ≥${RETENTION_GOALS[r.year]}%`}
              valueLabel={fmtPct(r.rate)}
              fillPct={r.rate * 100}
              goalPct={RETENTION_GOALS[r.year]}
            />
          ))}
        </Card>

        {/* Cuadro 3: Program Satisfaction — no data source, honest pending state */}
        <Card>
          <div className="mb-3.5 flex items-center gap-2">
            <div className="text-[13.5px] font-bold text-surface-dark">Program Satisfaction</div>
            <ProxyBadge>PROXY</ProxyBadge>
          </div>
          <div className="flex flex-wrap gap-4">
            <StatChip value="—" label="Goal" />
            <StatChip value="—" label={`Result · ${o.currentPeriod}`} />
          </div>
          <p className="mt-3.5 text-xs text-muted">
            No survey data source yet — pending an approved satisfaction formula.
          </p>
        </Card>

        {/* Cuadro 4: Academic Progress */}
        <Card>
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-1.5">
            <div className="text-[13.5px] font-bold text-surface-dark">Academic Progress</div>
            <div className="text-xs text-muted">
              {gpaKpi.label} <b className="text-sm text-surface-dark">{gpaKpi.value}</b>
            </div>
          </div>
          <PaceBarChart
            data={[
              {
                label: "On track",
                note: "Following their study plan",
                valueLabel: `${progressPct(ON_TRACK)}%`,
                heightPct: progressPct(ON_TRACK),
                color: "#27cf77",
              },
              {
                label: "Behind",
                note: "One course behind",
                valueLabel: `${progressPct(behindCount)}%`,
                heightPct: progressPct(behindCount),
                color: "#8fe0b4",
              },
              {
                label: "Critical",
                note: "More than one course behind",
                valueLabel: `${progressPct(CRITICAL_DELAY)}%`,
                heightPct: progressPct(CRITICAL_DELAY),
                color: "#a62bff",
              },
            ]}
          />
        </Card>

        {/* Cuadro 5: Dropouts — count is real; a per-reason breakdown has no data source yet. */}
        <Card>
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-1.5">
            <div className="text-[13.5px] font-bold text-surface-dark">Dropouts</div>
            <div className="text-xs text-muted">{fmtPct(dropoutRate)} of active scholars</div>
          </div>
          <div className="mb-3.5 text-[32px] font-extrabold text-[#d33636]">
            {fmtInt(o.withdrawnScholars)}
          </div>
          <p className="text-xs text-muted">
            Reason breakdown (financial, academic, psychosocial, relocation) isn&rsquo;t tracked in
            the data yet.
          </p>
        </Card>

        {/* Cuadro 6: Socioeconomic Condition */}
        <Card>
          <div className="mb-3.5 text-[13.5px] font-bold text-surface-dark">
            Socioeconomic Condition
          </div>
          {sesTotal === 0 ? (
            <p className="text-sm text-muted">No socioeconomic data for the current selection.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {home.socioeconomicBreakdown.map((s) => (
                <StatChip
                  key={s.level}
                  tone={s.level === "Baja" ? "green" : s.level === "Alta" ? "red" : "default"}
                  value={fmtPct(s.count / sesTotal)}
                  label={s.level}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <BigTitle>Active Scholars by City (Colombia)</BigTitle>
      <Card className="p-6">
        {home.cityBreakdown.length === 0 ? (
          <p className="text-sm text-muted">No city data for the current selection.</p>
        ) : (
          <>
            <PaceBarChart
              barAreaPx={150}
              barWidthPx={56}
              data={home.cityBreakdown.map((c) => ({
                label: c.city,
                valueLabel: fmtInt(c.count),
                heightPct: cityMax ? Math.round((c.count / cityMax) * 100) : 0,
                color: c.city === "Other cities" ? "#d9c7f5" : "#a62bff",
              }))}
            />
            <div className="mt-4 text-xs text-muted">Active scholars in Colombia by city.</div>
          </>
        )}
      </Card>

      <BigTitle>All Universities &mdash; Retention &amp; Drop Out Rate</BigTitle>
      <Card className="p-6">
        {home.universityRetention.length === 0 ? (
          <p className="text-sm text-muted">No universities in scope for this selection.</p>
        ) : (
          <UniversityRetentionList
            data={home.universityRetention.map((u) => ({
              name: u.name,
              retentionPct: u.retentionPct,
              dropOutPct: u.dropOutPct,
            }))}
          />
        )}
      </Card>

      <BigTitle>Scholars by Year</BigTitle>
      <Card className="p-6">
        <PaceBarChart
          barAreaPx={180}
          barWidthPx={64}
          data={yearBars.map(({ key, label }) => {
            const count = home.scholarsByYear[key];
            const pct = activeTotal ? Math.round((count / activeTotal) * 100) : 0;
            return {
              label,
              note: `${pct}% of active scholars`,
              valueLabel: fmtInt(count),
              heightPct: pct,
              color: key === "year1" ? "#27cf77" : key === "year2" ? "#8fe0b4" : "#a62bff",
            };
          })}
        />
        <div className="mt-4 flex flex-col gap-1 text-xs text-muted">
          <div>
            Years 1–2 — <b className="text-ink">Early Support:</b> academic &amp; psychosocial
            support
          </div>
          <div>
            Year 3 onward — <b className="text-ink">Growth &amp; Development:</b> professional
            development
          </div>
        </div>
      </Card>

      <BigTitle>English Level Distribution</BigTitle>
      {home.englishLevelDistribution ? (
        <Card className="p-6">
          <PaceBarChart
            barAreaPx={140}
            data={home.englishLevelDistribution.map((e) => ({
              label: e.level,
              valueLabel: fmtPct(englishTotal ? e.count / englishTotal : 0),
              heightPct: englishMax ? Math.round((e.count / englishMax) * 100) : 0,
              color: ENGLISH_DEVELOPING.includes(e.level) ? "#a62bff" : "#27cf77",
            }))}
          />
          <div className="mt-3.5 text-xs text-muted">
            A1&ndash;B1: developing proficiency · B2&ndash;C2: professional working proficiency
          </div>
        </Card>
      ) : (
        <Card className="flex items-center justify-between gap-4 p-6">
          <p className="text-sm text-muted">
            Each scholar&rsquo;s current English level now syncs (shown on the scholar profile). This
            program-wide distribution appears once levels are populated across scholars.
          </p>
          <ProxyBadge>PENDING</ProxyBadge>
        </Card>
      )}

      {/* Executive attention band — kept from the prior implementation (not in the mockup,
          but useful working navigation the redesign doesn't replace). */}
      <BigTitle>Executive Attention</BigTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/dashboard/early-support" className="block">
          <KpiCard
            label="High or critical risk"
            value={fmtInt(criticalCount)}
            sub="Scholars needing attention"
          />
        </Link>
        <Link href="/dashboard/early-support" className="block">
          <KpiCard
            label="Missing reports"
            value={fmtInt(missingReportsCount)}
            sub="Check-in or mentoring this month"
          />
        </Link>
        <KpiCard label="Withdrawals" value={fmtInt(o.withdrawnScholars)} sub="In the selected group" />
      </div>
    </div>
  );
}
