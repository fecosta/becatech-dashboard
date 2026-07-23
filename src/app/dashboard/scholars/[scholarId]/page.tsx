import Link from "next/link";
import { notFound } from "next/navigation";
import { LineCard } from "@/components/charts";
import { Column, DataTable } from "@/components/DataTable";
import { ProfileCard } from "@/components/ProfileCard";
import { AccessDenied, Card, KpiCard, PageHeader, RiskBadge, SectionTitle } from "@/components/ui";
import { requireScholarAccess } from "@/lib/auth/guard";
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

export default async function ScholarProfilePage({
  params,
}: {
  params: Promise<{ scholarId: string }>;
}) {
  const { scholarId } = await params;
  const { allowed } = await requireScholarAccess(scholarId);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Scholar Profile" />
        <AccessDenied message="You don't have access to this scholar." />
      </div>
    );
  }

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
    <div>
      <Link href="/dashboard/scholars" className="text-xs text-muted hover:underline">
        ← Back to scholars
      </Link>
      <PageHeader title={p.fullName} subtitle={`${p.scholarId} · ${p.academicProgram}`} />

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
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Cumulative GPA" value={fmtGpa(latestTerm?.accumulatedGpa)} />
        <KpiCard label="Current risk" value={latestRisk ? <RiskBadge level={latestRisk.globalRiskLevel} /> : "—"} />
        <KpiCard label="Semester" value={p.currentSemester ?? "—"} />
        <KpiCard label="Progress" value={latestTerm?.progressPercentage != null ? `${latestTerm.progressPercentage}%` : "—"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <LineCard
          title="GPA trend"
          data={gpaData}
          xKey="term"
          lines={[
            { key: "gpa", name: "Term GPA", color: "#a62bff" },
            { key: "accumulated", name: "Cumulative GPA", color: "#27cf77" },
          ]}
        />
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
  );
}
