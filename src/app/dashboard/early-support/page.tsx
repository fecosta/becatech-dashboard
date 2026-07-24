import type { AlertType, RiskLevel } from "@/generated/prisma/enums";
import { ComboBarLineCard, Donut, LineCard } from "@/components/charts";
import { UniHBarRow } from "@/components/UniHBarRow";
import { AccessDenied, Card, DarkCallout, PageHeader, SectionTitle, StatChip } from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import {
  getAcademicProgress,
  getExecutiveOverview,
  getHomeOverview,
  getMonthlyRiskTrend,
  getRiskStageSummary,
  getSupportParticipation,
  getUniversityRiskBreakdown,
} from "@/lib/dashboard/queries";
import { ALERT_TYPE_LABEL, RISK_LEVEL_HEX_SEGMENTED, RISK_LEVEL_LABEL, RISK_LEVEL_NOTE } from "@/lib/labels";
import { fmtInt, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

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
  const { allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Early Support" tag="Years 1–2" />
        <AccessDenied />
      </div>
    );
  }

  // Years 1–2 band derived from currentSemester (documented default — see program-stage.ts).
  const filters = parseFilters(await searchParams);
  const stageFilters = { ...filters, programStage: "YEARS_1_2" as const };
  const [risk, support, pace, stageOverview, overallOverview, home, uniBreakdown, riskTrend] =
    await Promise.all([
      getRiskStageSummary(stageFilters),
      getSupportParticipation(stageFilters),
      getAcademicProgress(stageFilters),
      getExecutiveOverview(stageFilters),
      getExecutiveOverview(filters),
      getHomeOverview(stageFilters),
      getUniversityRiskBreakdown(stageFilters),
      getMonthlyRiskTrend(stageFilters),
    ]);

  const atRisk = ALERT_SPLIT_ORDER.reduce((sum, t) => sum + risk.alertTypeCounts[t], 0);
  const onTrack = pace.progressStatusDistribution.ON_TRACK;
  const behind = pace.progressStatusDistribution.SLIGHTLY_BEHIND + pace.progressStatusDistribution.BEHIND;
  const critical = pace.progressStatusDistribution.CRITICAL_DELAY;

  const riskTotal = RISK_ORDER.reduce((sum, l) => sum + risk.distribution[l], 0);
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

      <div className="flex divide-x divide-border overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex-1 px-2.5 py-[18px] text-center">
          <div className="text-2xl font-extrabold text-purple">{fmtInt(stageOverview.activeScholars)}</div>
          <div className="mt-1 text-[11.5px] text-muted">
            Total scholars <span className="opacity-70">({fmtPct(stagePct)} of all active)</span>
          </div>
        </div>
        <div className="flex-1 px-2.5 py-[18px] text-center">
          <div className="text-2xl font-extrabold text-green">{fmtPct(year1?.rate ?? 0)}</div>
          <div className="mt-1 text-[11.5px] text-muted">Year 1 retention</div>
        </div>
        <div className="flex-1 px-2.5 py-[18px] text-center">
          <div className="text-2xl font-extrabold text-green">{fmtPct(year2?.rate ?? 0)}</div>
          <div className="mt-1 text-[11.5px] text-muted">Year 2 retention</div>
        </div>
      </div>

      <div className="mt-4">
        <DarkCallout
          label="Critical + High risk scholars"
          value={fmtInt(risk.criticalHighCount)}
          note="Need attention this month"
        />
      </div>

      <div className="mt-6">
        <SectionTitle>Scholars Status</SectionTitle>
        <Card>
          {riskTotal === 0 ? (
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

      <div className="mt-6">
        <SectionTitle>Scholars Status per University</SectionTitle>
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
          <div className="text-xs text-muted">% of scholars in each tier with ≥1 activity this month</div>
        </div>
        <div className="flex flex-wrap gap-4">
          {support.byRiskLevel.map((r) => (
            <StatChip
              key={r.riskLevel}
              tone={PARTICIPATION_TONE[r.riskLevel]}
              value={fmtPct(r.participatedPct)}
              label={RISK_LEVEL_LABEL[r.riskLevel]}
            />
          ))}
        </div>
      </Card>

      <div className="mt-6">
        <SectionTitle>Academic Progress</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-1.5 text-[13.5px] font-bold text-surface-dark">On track vs. behind</div>
            <div className="flex flex-wrap gap-4 pt-2">
              <StatChip value={fmtInt(onTrack)} label="On track with study plan" />
              <StatChip value={fmtInt(behind)} label="Need to catch up / level" />
              {critical > 0 ? <StatChip tone="red" value={fmtInt(critical)} label="Critical delay" /> : null}
            </div>
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
