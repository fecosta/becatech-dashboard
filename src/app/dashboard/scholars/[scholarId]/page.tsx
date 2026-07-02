import Link from "next/link";
import { notFound } from "next/navigation";
import { LineCard } from "@/components/charts";
import { Column, DataTable } from "@/components/DataTable";
import { Badge, Card, KpiCard, PageHeader, RiskBadge, SectionTitle } from "@/components/ui";
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
  COUNTRY_LABEL,
  PROGRAM_STATUS_LABEL,
  PROGRESS_STATUS_LABEL,
  REQUEST_STATUS_LABEL,
  REVIEW_STATUS_LABEL,
  RISK_CHANGE_LABEL,
} from "@/lib/labels";

const money = (amount: unknown, currency: string) =>
  new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    Number(amount),
  );

export default async function ScholarProfilePage({
  params,
}: {
  params: Promise<{ scholarId: string }>;
}) {
  const { scholarId } = await params;
  const p = await getScholarProfile(scholarId);
  if (!p) notFound();

  const latestTerm = p.academicTerms.at(-1) ?? null;
  const latestRisk = p.riskAssessments.at(-1) ?? null;

  const gpaData = p.gpaTrend.map((t) => ({ term: t.term, gpa: t.gpa, accumulated: t.accumulatedGpa }));
  const riskData = p.riskAssessments.map((r) => ({
    period: r.period,
    Global: r.globalRiskValue,
    Académico: r.academicRiskValue,
    Psicosocial: r.psychosocialRiskValue,
    Participación: r.participationRiskValue,
  }));

  const supportByType = new Map<ActivityType, number>();
  for (const a of p.supportActivities) {
    supportByType.set(a.activityType, (supportByType.get(a.activityType) ?? 0) + a.activityCount);
  }
  const supportRows = [...supportByType.entries()]
    .map(([activityType, total]) => ({ activityType, total }))
    .sort((a, b) => b.total - a.total);

  const termCols: Column<AcademicTerm>[] = [
    { header: "Término", cell: (t) => t.term },
    { header: "Matrícula", cell: (t) => t.enrollmentStatus ?? "—" },
    { header: "Créditos", cell: (t) => `${t.creditsCompleted ?? "—"} / ${t.creditsEnrolled ?? "—"}` },
    { header: "Avance", cell: (t) => (t.progressPercentage != null ? `${t.progressPercentage}%` : "—") },
    { header: "Estado", cell: (t) => (t.expectedProgressStatus ? PROGRESS_STATUS_LABEL[t.expectedProgressStatus] : "—") },
    { header: "GPA", cell: (t) => fmtGpa(t.gpa) },
    { header: "Reprobadas", cell: (t) => t.failedSubjectsCount ?? 0 },
  ];
  const riskCols: Column<RiskAssessment>[] = [
    { header: "Periodo", cell: (r) => r.period },
    { header: "Global", cell: (r) => <RiskBadge level={r.globalRiskLevel} /> },
    { header: "Alerta", cell: (r) => ALERT_TYPE_LABEL[r.alertType] },
    { header: "Cambio", cell: (r) => (r.riskChangeLabel ? RISK_CHANGE_LABEL[r.riskChangeLabel] : "—") },
    { header: "Revisión", cell: (r) => REVIEW_STATUS_LABEL[r.reviewStatus] },
    { header: "Motivo", cell: (r) => r.riskReason ?? "—" },
  ];
  const checkinCols: Column<MonthlyCheckin>[] = [
    { header: "Mes", cell: (c) => c.reportingMonth },
    { header: "Académico", cell: (c) => c.academicLevel ?? "—" },
    { header: "Emocional", cell: (c) => c.psychosocialLevel ?? "—" },
    { header: "Estado", cell: (c) => c.finalStatus ?? "—" },
  ];
  const mentorCols: Column<MentorReport>[] = [
    { header: "Mes", cell: (m) => m.reportingMonth ?? "—" },
    { header: "Sesión", cell: (m) => m.sessionType ?? "—" },
    { header: "Permanencia", cell: (m) => m.permanenceRisk ?? "—" },
    { header: "Aprob.", cell: (m) => m.approvedCoursesCount ?? "—" },
    { header: "En riesgo", cell: (m) => m.atRiskCoursesCount ?? "—" },
    { header: "Próximos pasos", cell: (m) => m.nextSteps ?? "—" },
  ];
  const supportCols: Column<{ activityType: ActivityType; total: number }>[] = [
    { header: "Actividad", cell: (s) => ACTIVITY_TYPE_LABEL[s.activityType] },
    { header: "Total sesiones", cell: (s) => s.total },
  ];
  const requestCols: Column<ScholarRequest>[] = [
    { header: "Fecha", cell: (r) => fmtDate(r.submissionDate) },
    { header: "Tipo", cell: (r) => r.requestType },
    { header: "Estado", cell: (r) => REQUEST_STATUS_LABEL[r.status] },
    { header: "Canal", cell: (r) => r.responseChannel ?? "—" },
  ];
  const financeCols: Column<FinancialInput>[] = [
    { header: "Categoría", cell: (f) => f.costCategory },
    { header: "Monto", cell: (f) => money(f.costAmount, f.currency), className: "text-right" },
    { header: "Directo", cell: (f) => (f.isDirectCost ? "Sí" : "No") },
    { header: "Fuente", cell: (f) => f.fundingSource ?? "—" },
  ];

  return (
    <div>
      <Link href="/dashboard/scholars" className="text-xs text-slate-500 hover:underline">
        ← Volver a becarios
      </Link>
      <PageHeader title={p.fullName} subtitle={`${p.scholarId} · ${p.academicProgram}`} />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone="blue">{COUNTRY_LABEL[p.country]}</Badge>
        <Badge>{PROGRAM_STATUS_LABEL[p.programStatus]}</Badge>
        <Badge>Cohorte {p.cohort}</Badge>
        <Badge>{p.university}</Badge>
        {p.currentMentor ? <Badge>Mentor: {p.currentMentor}</Badge> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="GPA acumulado" value={fmtGpa(latestTerm?.accumulatedGpa)} />
        <KpiCard label="Riesgo actual" value={latestRisk ? <RiskBadge level={latestRisk.globalRiskLevel} /> : "—"} />
        <KpiCard label="Semestre" value={p.currentSemester ?? "—"} />
        <KpiCard label="Avance" value={latestTerm?.progressPercentage != null ? `${latestTerm.progressPercentage}%` : "—"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <LineCard
          title="Tendencia de GPA"
          data={gpaData}
          xKey="term"
          lines={[
            { key: "gpa", name: "GPA del término", color: "#6366f1" },
            { key: "accumulated", name: "GPA acumulado", color: "#10b981" },
          ]}
        />
        <LineCard
          title="Historial de riesgo (0–4)"
          data={riskData}
          xKey="period"
          lines={[
            { key: "Global", name: "Global", color: "#ef4444" },
            { key: "Académico", name: "Académico", color: "#6366f1" },
            { key: "Psicosocial", name: "Psicosocial", color: "#f59e0b" },
            { key: "Participación", name: "Participación", color: "#14b8a6" },
          ]}
        />
      </div>

      <div className="mt-6 space-y-6">
        <section>
          <SectionTitle>Términos académicos</SectionTitle>
          <DataTable columns={termCols} rows={p.academicTerms} />
        </section>
        <section>
          <SectionTitle>Historial de riesgo</SectionTitle>
          <DataTable columns={riskCols} rows={p.riskAssessments} />
        </section>
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <SectionTitle>Check-ins mensuales</SectionTitle>
            <DataTable columns={checkinCols} rows={p.checkins} empty="Sin check-ins" />
          </section>
          <section>
            <SectionTitle>Participación en apoyo</SectionTitle>
            <DataTable columns={supportCols} rows={supportRows} empty="Sin actividades" />
          </section>
        </div>
        <section>
          <SectionTitle>Reportes de mentoría</SectionTitle>
          <DataTable columns={mentorCols} rows={p.mentorReports} empty="Sin reportes" />
        </section>
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <SectionTitle>Solicitudes</SectionTitle>
            <DataTable columns={requestCols} rows={p.requests} empty="Sin solicitudes" />
          </section>
          <section>
            <SectionTitle>Costos y apoyo económico</SectionTitle>
            <DataTable columns={financeCols} rows={p.financialInputs} empty="Sin registros" />
          </section>
        </div>
      </div>
      <Card className="mt-6 text-xs text-slate-400">Carpeta: {p.driveFolderUrl ?? "—"}</Card>
    </div>
  );
}
