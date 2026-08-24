import Link from "next/link";
import type { AlertType, RiskLevel } from "@/generated/prisma/enums";
import { ComboBarLineCard, Donut, LineCard } from "@/components/charts";
import { PaceBarChart } from "@/components/PaceBarChart";
import { ExecTable, type ExecRow } from "@/components/ExecTable";
import { FactStrip } from "@/components/FactStrip";
import { UniHBarRow } from "@/components/UniHBarRow";
import {
  AccessDenied,
  Card,
  DarkCallout,
  KpiCard,
  PageHeader,
  SectionTitle,
  StatChip,
} from "@/components/ui";
import { SectionNav } from "@/components/SectionNav";
import { gpaSummaryKpi } from "@/lib/academic/gpa-summary";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import {
  getAcademicProgress,
  getExecutiveOverview,
  getHomeOverview,
  getMonthlyRiskTrend,
  getRiskBreakdowns,
  getParticipationByActivityAndRisk,
  getRiskAlerts,
  getRiskByGender,
  getRiskReasonBreakdown,
  getRiskStageSummary,
  getSupportParticipation,
  getUniversityRiskBreakdown,
} from "@/lib/dashboard/queries";
import { ALERT_TYPE_LABEL, RISK_LEVEL_HEX_SEGMENTED, RISK_LEVEL_LABEL, RISK_LEVEL_NOTE } from "@/lib/labels";
import {
  ACTIVITY_GROUP_LABEL,
  RISK_TIER_LABEL,
  RISK_TIER_ORDER,
} from "@/lib/dashboard/risk-tier";
import { fmtInt, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

const GENDER_LABEL: Record<"female" | "male" | "other", string> = {
  female: "Women",
  male: "Men",
  other: "Other",
};

// Alert types shown in the split, in priority order. NONE is intentionally excluded.
const ALERT_SPLIT_ORDER: AlertType[] = [
  "ACADEMIC",
  "PSYCHOSOCIAL",
  "PARTICIPATION",
  "COMBINED",
  "PERMANENCE",
];
const RISK_ORDER: RiskLevel[] = ["SIN_RIESGO", "RIESGO_BAJO", "RIESGO_MEDIO", "RIESGO_ALTO", "CRITICO"];
// No Risk/Low read as healthy (green), High/Critical as needing attention (red).
const PARTICIPATION_TONE: Record<RiskLevel, "green" | "default" | "red"> = {
  SIN_RIESGO: "green",
  RIESGO_BAJO: "green",
  RIESGO_MEDIO: "default",
  RIESGO_ALTO: "red",
  CRITICO: "red",
};

export default async function EarlySupportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Early Support" tag="Years 1–2" />
        <AccessDenied />
      </div>
    );
  }

  // Years 1–2 band derived from currentSemester (documented default — see program-stage.ts).
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const stageFilters = { ...filters, programStage: "YEARS_1_2" as const };
  const [
    risk,
    support,
    pace,
    stageOverview,
    overallOverview,
    home,
    uniBreakdown,
    riskTrend,
    breakdowns,
    alerts,
    reasons,
    participation,
    byGender,
  ] = await Promise.all([
    getRiskStageSummary(stageFilters),
    getSupportParticipation(stageFilters),
    getAcademicProgress(stageFilters, user),
    getExecutiveOverview(stageFilters),
    getExecutiveOverview(filters),
    getHomeOverview(stageFilters),
    getUniversityRiskBreakdown(stageFilters),
    getMonthlyRiskTrend(stageFilters),
    getRiskBreakdowns(stageFilters),
    getRiskAlerts(stageFilters, user),
    getRiskReasonBreakdown(stageFilters),
    getParticipationByActivityAndRisk(stageFilters),
    getRiskByGender(stageFilters),
  ]);

  const missingReportsCount = alerts.attentionList.filter(
    (r) => r.missingCheckin || r.missingMentorReport,
  ).length;

  const atRisk = ALERT_SPLIT_ORDER.reduce((sum, t) => sum + risk.alertTypeCounts[t], 0);
  const onTrack = pace.progressStatusDistribution.ON_TRACK;
  const behind = pace.progressStatusDistribution.SLIGHTLY_BEHIND + pace.progressStatusDistribution.BEHIND;
  const critical = pace.progressStatusDistribution.CRITICAL_DELAY;
  const progressTotal = onTrack + behind + critical;
  const progressPct = (n: number) => (progressTotal ? Math.round((n / progressTotal) * 100) : 0);

  // Denominator for the level percentages = active, ≠Cohorte-2024 scholars (the program's official
  // denominator), so "No risk" reads e.g. 63% of all eligible scholars — not 63% of only the
  // classified ones. `riskClassified` (levels sum) just gates whether there's a donut to show.
  const riskTotal = risk.assessedScholarCount;
  const riskClassified = RISK_ORDER.reduce((sum, l) => sum + risk.distribution[l], 0);
  const donutData = RISK_ORDER.map((l) => ({
    name: RISK_LEVEL_LABEL[l],
    value: risk.distribution[l],
    color: RISK_LEVEL_HEX_SEGMENTED[l],
  }));

  const year1 = home.retentionByYear.find((r) => r.year === 1);
  const year2 = home.retentionByYear.find((r) => r.year === 2);
  // activeScholars (not totalScholars) so this is a proper subset of overallOverview's
  // active count — otherwise withdrawn/paused/graduated Years-1-2 scholars could push
  // the ratio above 100%.
  const stagePct = overallOverview.activeScholars
    ? stageOverview.activeScholars / overallOverview.activeScholars
    : 0;

  const gpaDist = pace.gpaDistribution;
  // Country-aware GPA header (Colombia /5, Peru /20, or a scale-agnostic index for a mixed scope).
  const gpaKpi = gpaSummaryKpi(pace.gpaSummary);
  const gpaTotal = gpaDist.below3_5 + gpaDist.from3_5To3_9 + gpaDist.from4_0To5_0;
  const gpaPct = (n: number) => (gpaTotal ? Math.round((n / gpaTotal) * 100) : 0);

  return (
    <div>
      <PageHeader
        title="Early Support — Academic &amp; Psychosocial"
        tag="Years 1–2"
        subtitle="During the first two years, we accompany scholars along two parallel tracks."
      />

      <div className="mb-5 flex flex-col gap-2.5">
        <div className="flex max-w-[720px] items-start gap-2.5 text-sm leading-relaxed text-ink">
          <span className="mt-0.5 flex-shrink-0 font-extrabold text-green">✓</span>
          <div>
            <b>Academic support:</b> tutoring, advising, study groups, and workshops that
            strengthen the skills scholars need to meet university demands.
          </div>
        </div>
        <div className="flex max-w-[720px] items-start gap-2.5 text-sm leading-relaxed text-ink">
          <span className="mt-0.5 flex-shrink-0 font-extrabold text-purple">✓</span>
          <div>
            <b>Psychosocial support:</b> individual and group activities that build socioemotional
            skills, overall wellbeing, and support networks.
          </div>
        </div>
      </div>

      <SectionTitle size="lg" id="early-sec-1">
        1 · Scholars in Years 1 and 2
      </SectionTitle>
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
          { value: fmtPct(year1?.rate ?? 0), label: "Year 1 retention", tone: "green" },
          { value: fmtPct(year2?.rate ?? 0), label: "Year 2 retention", tone: "green" },
        ]}
      />

      <div className="mt-4">
        <DarkCallout
          label="Critical + High risk scholars"
          value={fmtInt(risk.criticalHighCount)}
          note="Need attention this month"
        />
        {risk.insufficientDataCount > 0 ? (
          <p className="mt-2 text-xs text-amber-700">
            {fmtInt(risk.insufficientDataCount)} scholar
            {risk.insufficientDataCount === 1 ? " has" : "s have"} insufficient data this month
            (a risk dimension was not reported) — shown separately and not counted as high risk.
          </p>
        ) : null}
      </div>

      {/* Relocated from Home: these are the numbers a coordinator acts on, and acting on
          them means being on this page. Home now opens with the program story instead. */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="High or critical risk"
          value={fmtInt(risk.criticalHighCount)}
          sub="Scholars needing attention"
        />
        <Link href="/dashboard/scholars" className="block">
          <KpiCard
            label="Missing reports"
            value={fmtInt(missingReportsCount)}
            sub="Check-in or mentoring this month"
          />
        </Link>
        <KpiCard
          label="Withdrawals"
          value={fmtInt(stageOverview.withdrawnScholars)}
          sub="In the selected group"
        />
      </div>

      <SectionTitle size="lg" id="early-sec-2">
        2 · Scholar Status
      </SectionTitle>
      <div>
        <Card>
          <div className="mb-3.5 text-[13.5px] font-bold text-surface-dark">2.1 Overall Status</div>
          {riskClassified === 0 ? (
            <p className="text-sm text-muted">No risk data for the current selection.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              <Donut data={donutData} />
              <div className="flex flex-col gap-2 text-[12.5px]">
                {RISK_ORDER.map((l) => (
                  <div key={l} className="flex items-baseline gap-2">
                    <b className="inline-flex min-w-[110px] items-center gap-1.5">
                      <i
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: RISK_LEVEL_HEX_SEGMENTED[l] }}
                      />
                      {RISK_LEVEL_LABEL[l]} ·{" "}
                      {Math.round((risk.distribution[l] / riskTotal) * 100)}%
                    </b>
                    <span className="text-muted">{RISK_LEVEL_NOTE[l]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {riskClassified === 0 ? null : (
            <div className="mt-5">
              <ExecTable
                headers={["Risk level", "%", "Scholars", "What it means"]}
                rows={[
                  ...RISK_ORDER.map<ExecRow>((l) => ({
                    key: l,
                    label: RISK_LEVEL_LABEL[l],
                    cells: [
                      `${Math.round((risk.distribution[l] / riskTotal) * 100)}%`,
                      fmtInt(risk.distribution[l]),
                      <span key="n" className="text-muted">
                        {RISK_LEVEL_NOTE[l]}
                      </span>,
                    ],
                  })),
                  {
                    key: "total",
                    label: "TOTAL",
                    summary: "actual",
                    cells: ["100%", fmtInt(riskTotal), ""],
                  },
                ]}
              />
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <LineCard
          title="Monthly Change in Risk Level"
          data={riskTrend.map((p) => ({ period: p.period, medPlus: Math.round(p.mediumPlusPct * 100) }))}
          xKey="period"
          lines={[{ key: "medPlus", name: "% in Medium+ risk", color: "#a62bff" }]}
        />
        <Card>
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-1.5">
            <div className="text-[13.5px] font-bold text-surface-dark">
              Alert Type: Psychosocial vs. Academic
            </div>
            <div className="text-xs text-muted">Medium / High / Critical scholars</div>
          </div>
          {atRisk === 0 ? (
            <p className="text-sm text-muted">No scholars at medium risk or above in this group.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {ALERT_SPLIT_ORDER.filter((t) => risk.alertTypeCounts[t] > 0).map((t) => (
                <StatChip
                  key={t}
                  value={fmtPct(risk.alertTypeCounts[t] / atRisk)}
                  label={`${ALERT_TYPE_LABEL[t]} alerts`}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-1.5">
          <div className="text-[13.5px] font-bold text-surface-dark">2.2 Reasons for Risk</div>
          <div className="text-xs text-muted">
            {fmtInt(reasons.atRiskScholarCount)} scholars at medium risk or above ·{" "}
            {reasons.period}
          </div>
        </div>
        {reasons.academic.rows.length === 0 && reasons.psychosocial.rows.length === 0 ? (
          <p className="text-sm text-muted">
            No risk reasons reported for this selection in {reasons.period}.
          </p>
        ) : (
          <>
            <div className="mb-2.5">
              <span className="inline-flex items-center rounded-[10px] border-2 border-green-dark bg-green px-4 py-2 text-xs font-extrabold text-white">
                Academic — {fmtInt(reasons.academic.scholarsWithAnyReason)} scholars
              </span>
            </div>
            <ExecTable
              headers={["Reason", "%", "Scholars"]}
              rows={reasons.academic.rows.map<ExecRow>((r) => ({
                key: r.category,
                label: r.label,
                cells: [`${r.pct}%`, fmtInt(r.scholarCount)],
              }))}
              empty="No academic reasons reported."
            />

            <div className="mb-2.5 mt-5">
              <span className="inline-flex items-center rounded-[10px] border-2 border-purple-dark bg-purple px-4 py-2 text-xs font-extrabold text-white">
                Psychosocial — {fmtInt(reasons.psychosocial.scholarsWithAnyReason)} scholars
              </span>
            </div>
            <ExecTable
              headers={["Reason", "%", "Scholars"]}
              rows={reasons.psychosocial.rows.map<ExecRow>((r) => ({
                key: r.category,
                label: r.label,
                cells: [`${r.pct}%`, fmtInt(r.scholarCount)],
              }))}
              empty="No psychosocial reasons reported."
            />

            <div className="mt-3.5 rounded-xl bg-chip-cream px-3.5 py-3 text-xs text-muted">
              <b className="text-ink">The two tables overlap and do not add up.</b>{" "}
              {fmtInt(reasons.bothAxesCount)} scholar
              {reasons.bothAxesCount === 1 ? " is" : "s are"} flagged on both axes, so each table is
              a percentage of its own group.
              {reasons.unclassifiedScholarCount > 0
                ? ` ${fmtInt(reasons.unclassifiedScholarCount)} scholar(s) were flagged only with options the reason grouping has not classified yet.`
                : ""}
            </div>
          </>
        )}
      </Card>

      {/* 2.3 — participation against risk, by activity. */}
      <Card className="mt-4">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-1.5">
          <div className="text-[13.5px] font-bold text-surface-dark">
            2.3 Participation and Risk Level
          </div>
          <div className="text-xs text-muted">{participation.period}</div>
        </div>
        <ExecTable
          headers={["Activity", ...RISK_TIER_ORDER.map((t) => RISK_TIER_LABEL[t])]}
          rows={participation.groups.map<ExecRow>((g) => ({
            key: g.activity,
            label: ACTIVITY_GROUP_LABEL[g.activity],
            cells: g.rows.map((r) =>
              r.pct == null ? "—" : `${r.pct}% (${r.participatedCount}/${r.scholarCount})`,
            ),
          }))}
          caption="Share of scholars in each tier with at least one session this month, with the counts behind it. These columns are integers with a zero default, so a blank report and a genuine zero look the same — which is why the denominator is always shown."
        />
        <div className="mt-3.5 rounded-xl bg-chip-cream px-3.5 py-3 text-xs text-muted">
          <b className="text-ink">The month-by-month trend is not shown yet.</b> Risk periods are
          currently keyed two different ways — the first two program months fall back to a calendar
          month because the sheet column that carries them is unmapped — so an M1→M6 line would
          compare unlike periods.
        </div>
      </Card>

      <div className="mt-6">
        <SectionTitle>2.4 Scholar Status per University</SectionTitle>
        <Card>
          {uniBreakdown.length === 0 ? (
            <p className="text-sm text-muted">No universities in scope for this selection.</p>
          ) : (
            <UniHBarRow
              data={uniBreakdown.map((u) => ({
                name: u.universityName,
                country: u.country,
                lowRiskPct: u.lowRiskPercentage,
              }))}
            />
          )}
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle>2.5 Risk Level by Gender</SectionTitle>
        <Card>
          <ExecTable
            headers={["Risk level", ...byGender.map((g) => GENDER_LABEL[g.gender])]}
            rows={[...RISK_TIER_ORDER].reverse().map<ExecRow>((tier) => ({
              key: tier,
              label: RISK_TIER_LABEL[tier],
              cells: byGender.map((g) => `${g.tierPct[tier]}% (${g.tiers[tier]})`),
            }))}
            empty="No gender data for this selection."
          />
        </Card>
      </div>

      {/* Kept past the redesign: whether vulnerability predicts risk is the program's
          core thesis, and no other section answers it. */}
      <div className="mt-6">
        <SectionTitle>2.6 Risk Level by Socioeconomic Condition</SectionTitle>
        <Card>
          {breakdowns.bySocioeconomic.length === 0 ? (
            <p className="text-sm text-muted">No socioeconomic data for this selection.</p>
          ) : (
            <UniHBarRow
              hideLegend
              data={breakdowns.bySocioeconomic.map((r) => ({ name: r.name, lowRiskPct: r.lowRiskPct }))}
            />
          )}
          <div className="mt-3.5 text-xs text-muted">
            Bar = % Low risk (No Risk + Low). Lower socioeconomic condition often correlates with
            higher risk.
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle>Participation in Support Activities</SectionTitle>
        <ComboBarLineCard
          title="Overall participation trend"
          data={support.byMonth.map((m) => ({
            period: m.period,
            activities: m.totalActivities,
            rate: Math.round(m.participationRatePct * 100),
          }))}
          xKey="period"
          barKey="activities"
          barName="Support activities"
          lineKey="rate"
          lineName="% scholars with ≥1 activity"
        />
      </div>

      <Card className="mt-4">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-1.5">
          <div className="text-[13.5px] font-bold text-surface-dark">Participation by Risk Level</div>
          <div className="text-xs text-muted">% of scholars in each tier with ≥1 support activity to date</div>
        </div>
        <div className="flex flex-wrap gap-4">
          {support.byRiskLevel
            .filter((r) => r.scholarCount > 0)
            .map((r) => (
              <StatChip
                key={r.riskLevel}
                tone={PARTICIPATION_TONE[r.riskLevel]}
                value={fmtPct(r.participatedPct)}
                label={`${RISK_LEVEL_LABEL[r.riskLevel]} · ${r.participatedCount}/${r.scholarCount} scholars`}
              />
            ))}
        </div>
      </Card>

      <SectionTitle size="lg" id="early-sec-3">
        3 · Academic Progress
      </SectionTitle>
      <div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-1.5 text-[13.5px] font-bold text-surface-dark">On track vs. behind</div>
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

      <SectionNav current="/dashboard/early-support" sp={sp} user={user} />
    </div>
  );
}
