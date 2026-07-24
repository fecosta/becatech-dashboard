// Full scholar record — Identity & Program, Academic Performance, Monthly Follow-Up
// heatmap (the mockup's "Scholar Profile" view), plus a "Full Record" section carrying
// forward the detail tables from the pre-merge profile page (additive, not replaced).
import { notFound } from "next/navigation";
import { LineCard } from "@/components/charts";
import { Column, DataTable } from "@/components/DataTable";
import { ProfileCard } from "@/components/ProfileCard";
import { RiskHeatmapTable } from "@/components/RiskHeatmapTable";
import { Card, PageHeader, ProxyBadge, RiskBadge, SectionTitle, StatChip, StatusBadge } from "@/components/ui";
import type {
  AcademicTerm,
  FinancialInput,
  MentorReport,
  MonthlyCheckin,
  RiskAssessment,
  ScholarRequest,
} from "@/generated/prisma/client";
import type { ActivityType } from "@/generated/prisma/enums";
import { getScholarProfile } from "@/lib/dashboard/queries";
import { fmtDate, fmtGpa } from "@/lib/format";
import {
  ACTIVITY_TYPE_LABEL,
  ALERT_TYPE_LABEL,
  PROGRESS_STATUS_LABEL,
  REQUEST_STATUS_LABEL,
  REVIEW_STATUS_LABEL,
  RISK_CHANGE_LABEL,
} from "@/lib/labels";

const money = (amount: unknown, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    Number(amount),
  );

export async function ScholarProfileView({ scholarId }: { scholarId: string }) {
  const p = await getScholarProfile(scholarId);
  if (!p) notFound();

  const latestTerm = p.academicTerms.at(-1) ?? null;
  const latestRisk = p.riskAssessments.at(-1) ?? null;

  // Recent activities = distinct support-activity types in the latest period on record.
  const latestSupportPeriod = p.supportActivities.at(-1)?.period ?? null;
  const recentActivities = latestSupportPeriod
    ? [
        ...new Set(
          p.supportActivities
            .filter((a) => a.period === latestSupportPeriod)
            .map((a) => a.activityType),
        ),
      ].map((t) => ACTIVITY_TYPE_LABEL[t])
    : [];

  const gpaData = p.gpaTrend.map((t) => ({ term: t.term, gpa: t.gpa, accumulated: t.accumulatedGpa }));

  const heatmapRows = p.riskAssessments.map((r) => ({
    period: r.period,
    academic: r.academicRiskLevel,
    psychosocial: r.psychosocialRiskLevel,
    global: r.globalRiskLevel,
  }));

  const riskData = p.riskAssessments.map((r) => ({
    period: r.period,
    Global: r.globalRiskValue,
    Academic: r.academicRiskValue,
    Psychosocial: r.psychosocialRiskValue,
    Participation: r.participationRiskValue,
  }));

  const supportByType = new Map<ActivityType, number>();
  for (const a of p.supportActivities) {
    supportByType.set(a.activityType, (supportByType.get(a.activityType) ?? 0) + a.activityCount);
  }
  const supportRows = [...supportByType.entries()]
    .map(([activityType, total]) => ({ activityType, total }))
    .sort((a, b) => b.total - a.total);

  const termCols: Column<AcademicTerm>[] = [
    { header: "Term", cell: (t) => t.term },
    { header: "Enrollment", cell: (t) => t.enrollmentStatus ?? "—" },
    { header: "Credits", cell: (t) => `${t.creditsCompleted ?? "—"} / ${t.creditsEnrolled ?? "—"}` },
    { header: "Progress", cell: (t) => (t.progressPercentage != null ? `${t.progressPercentage}%` : "—") },
    { header: "Status", cell: (t) => (t.expectedProgressStatus ? PROGRESS_STATUS_LABEL[t.expectedProgressStatus] : "—") },
    { header: "GPA", cell: (t) => fmtGpa(t.gpa) },
    { header: "Failed", cell: (t) => t.failedSubjectsCount ?? 0 },
  ];
  const riskCols: Column<RiskAssessment>[] = [
    { header: "Period", cell: (r) => r.period },
    { header: "Global", cell: (r) => <RiskBadge level={r.globalRiskLevel} /> },
    { header: "Alert", cell: (r) => ALERT_TYPE_LABEL[r.alertType] },
    { header: "Change", cell: (r) => (r.riskChangeLabel ? RISK_CHANGE_LABEL[r.riskChangeLabel] : "—") },
    { header: "Review", cell: (r) => REVIEW_STATUS_LABEL[r.reviewStatus] },
    { header: "Reason", cell: (r) => r.riskReason ?? "—" },
  ];
  const checkinCols: Column<MonthlyCheckin>[] = [
    { header: "Month", cell: (c) => c.reportingMonth },
    { header: "Academic", cell: (c) => c.academicLevel ?? "—" },
    { header: "Emotional", cell: (c) => c.psychosocialLevel ?? "—" },
    { header: "Status", cell: (c) => c.finalStatus ?? "—" },
  ];
  const mentorCols: Column<MentorReport>[] = [
    { header: "Month", cell: (m) => m.reportingMonth ?? "—" },
    { header: "Session", cell: (m) => m.sessionType ?? "—" },
    { header: "Permanence", cell: (m) => m.permanenceRisk ?? "—" },
    { header: "Approved", cell: (m) => m.approvedCoursesCount ?? "—" },
    { header: "At risk", cell: (m) => m.atRiskCoursesCount ?? "—" },
    { header: "Next steps", cell: (m) => m.nextSteps ?? "—" },
  ];
  const supportCols: Column<{ activityType: ActivityType; total: number }>[] = [
    { header: "Activity", cell: (s) => ACTIVITY_TYPE_LABEL[s.activityType] },
    { header: "Total sessions", cell: (s) => s.total },
  ];
  const requestCols: Column<ScholarRequest>[] = [
    { header: "Date", cell: (r) => fmtDate(r.submissionDate) },
    { header: "Type", cell: (r) => r.requestType },
    { header: "Status", cell: (r) => REQUEST_STATUS_LABEL[r.status] },
    { header: "Channel", cell: (r) => r.responseChannel ?? "—" },
  ];
  const financeCols: Column<FinancialInput>[] = [
    { header: "Category", cell: (f) => f.costCategory },
    { header: "Amount", cell: (f) => money(f.costAmount, f.currency), className: "text-right" },
    { header: "Direct", cell: (f) => (f.isDirectCost ? "Yes" : "No") },
    { header: "Source", cell: (f) => f.fundingSource ?? "—" },
  ];

  return (
    <div className="mt-4">
      <PageHeader title={p.fullName} subtitle={`${p.scholarId} · ${p.academicProgram}`} />

      <SectionTitle>Identity &amp; Program</SectionTitle>
      <ProfileCard
        fullName={p.fullName}
        university={p.university.name}
        cohort={p.cohort}
        academicProgram={p.academicProgram}
        departmentOrigin={p.departmentOrigin}
        currentDepartment={p.currentDepartment}
        currentMunicipality={p.currentMunicipality}
        programStatus={p.programStatus}
        currentRiskLevel={latestRisk?.globalRiskLevel ?? null}
        activities={recentActivities}
        currentSemester={p.currentSemester}
        latestTerm={latestTerm?.term ?? null}
        gender={p.gender}
        expectedEndDate={p.expectedEndDate}
        operatorName={p.operator?.name ?? null}
      />

      <div className="mt-6">
        <SectionTitle>Academic Performance</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <LineCard
            title="GPA Trend"
            data={gpaData}
            xKey="term"
            lines={[
              { key: "gpa", name: "Term GPA", color: "#a62bff" },
              { key: "accumulated", name: "Cumulative GPA", color: "#27cf77" },
            ]}
          />
          <Card>
            <div className="mb-3.5 text-sm font-semibold text-ink">
              {latestTerm?.term ?? p.currentSemester ?? "Current"} Snapshot
            </div>
            <div className="flex flex-wrap gap-4">
              <StatChip value={<ProxyBadge>PENDING</ProxyBadge>} label="English Level" />
              <StatChip
                value={
                  latestTerm?.expectedProgressStatus ? (
                    <StatusBadge
                      tone={
                        latestTerm.expectedProgressStatus === "ON_TRACK" ? "green" : "amber"
                      }
                    >
                      {PROGRESS_STATUS_LABEL[latestTerm.expectedProgressStatus]}
                    </StatusBadge>
                  ) : (
                    "—"
                  )
                }
                label="Academic Progress"
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <SectionTitle>Monthly Follow-Up History</SectionTitle>
        <Card>
          <RiskHeatmapTable rows={heatmapRows} />
        </Card>
      </div>

      {/* Full Record — carried forward from the pre-merge profile page, additive (not in
          the mockup, but working case-management detail the redesign doesn't replace). */}
      <div className="mt-8">
        <SectionTitle>Full Record</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatChip value={fmtGpa(latestTerm?.accumulatedGpa)} label="Cumulative GPA" />
          <StatChip
            value={latestRisk ? <RiskBadge level={latestRisk.globalRiskLevel} /> : "—"}
            label="Current risk"
          />
          <StatChip value={p.currentSemester ?? "—"} label="Semester" />
          <StatChip
            value={latestTerm?.progressPercentage != null ? `${latestTerm.progressPercentage}%` : "—"}
            label="Progress"
          />
        </div>

        <div className="mt-4">
          <LineCard
            title="Risk history (0–4)"
            data={riskData}
            xKey="period"
            lines={[
              { key: "Global", name: "Global", color: "#0a0a0a" },
              { key: "Academic", name: "Academic", color: "#a62bff" },
              { key: "Psychosocial", name: "Psychosocial", color: "#f59e0b" },
              { key: "Participation", name: "Participation", color: "#27cf77" },
            ]}
          />
        </div>

        <div className="mt-6 space-y-6">
          <section>
            <SectionTitle>Academic terms</SectionTitle>
            <DataTable columns={termCols} rows={p.academicTerms} />
          </section>
          <section>
            <SectionTitle>Risk history</SectionTitle>
            <DataTable columns={riskCols} rows={p.riskAssessments} />
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <SectionTitle>Monthly check-ins</SectionTitle>
              <DataTable columns={checkinCols} rows={p.checkins} empty="No check-ins" />
            </section>
            <section>
              <SectionTitle>Support participation</SectionTitle>
              <DataTable columns={supportCols} rows={supportRows} empty="No activities" />
            </section>
          </div>
          <section>
            <SectionTitle>Mentor reports</SectionTitle>
            <DataTable columns={mentorCols} rows={p.mentorReports} empty="No reports" />
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <SectionTitle>Requests</SectionTitle>
              <DataTable columns={requestCols} rows={p.requests} empty="No requests" />
            </section>
            <section>
              <SectionTitle>Costs &amp; financial support</SectionTitle>
              <DataTable columns={financeCols} rows={p.financialInputs} empty="No records" />
            </section>
          </div>
        </div>
        <Card className="mt-6 text-xs text-muted">Folder: {p.driveFolderUrl ?? "—"}</Card>
      </div>
    </div>
  );
}
