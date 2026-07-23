import type { AlertType } from "@/generated/prisma/enums";
import { RiskBar } from "@/components/RiskBar";
import { AccessDenied, Card, DarkCallout, KpiCard, PageHeader, SectionTitle, StatChip } from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { getAcademicProgress, getRiskStageSummary, getSupportParticipation } from "@/lib/dashboard/queries";
import { ALERT_TYPE_LABEL } from "@/lib/labels";
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
  const filters = { ...parseFilters(await searchParams), programStage: "YEARS_1_2" as const };
  const [risk, support, pace] = await Promise.all([
    getRiskStageSummary(filters),
    getSupportParticipation(filters),
    getAcademicProgress(filters),
  ]);

  const atRisk = ALERT_SPLIT_ORDER.reduce((sum, t) => sum + risk.alertTypeCounts[t], 0);
  const onTrack = pace.progressStatusDistribution.ON_TRACK;
  const behind =
    pace.progressStatusDistribution.SLIGHTLY_BEHIND +
    pace.progressStatusDistribution.BEHIND +
    pace.progressStatusDistribution.CRITICAL_DELAY;

  return (
    <div>
      <PageHeader
        title="Early Support — Academic &amp; Psychosocial"
        tag="Years 1–2"
        subtitle="Are we catching risk early enough? Monthly follow-up on every scholar's status, the reason behind it, and whether they're keeping pace with their study plan."
      />

      <SectionTitle>Scholar Risk Level</SectionTitle>
      <Card>
        <RiskBar distribution={risk.distribution} />
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <DarkCallout
          label="Critical + High risk scholars"
          value={fmtInt(risk.criticalHighCount)}
          note="Need attention this month"
        />
        <KpiCard
          label="Participation in Support Activities"
          value={fmtPct(support.participationRate)}
          sub="Active scholars engaging in tutoring/mentoring"
        />
        <KpiCard
          label="Monthly Risk Change"
          value={`+${fmtInt(risk.improved)} / −${fmtInt(risk.worsened)}`}
          sub="Improved vs. worsened, month over month"
        />
      </div>

      <div className="mt-6">
        <SectionTitle>Alert Type (Medium / High / Critical scholars)</SectionTitle>
        <Card>
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
        <SectionTitle>Progress vs. Expected Pace</SectionTitle>
        <Card>
          <div className="flex flex-wrap gap-4">
            <StatChip value={fmtInt(onTrack)} label="On track with study plan" />
            <StatChip value={fmtInt(behind)} label="Need to catch up / level" />
          </div>
        </Card>
      </div>
    </div>
  );
}
