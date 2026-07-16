import Link from "next/link";
import { BarCard, PieCard } from "@/components/charts";
import { AccessDenied, Card, KpiCard, PageHeader, SectionTitle } from "@/components/ui";
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
const PROGRESS_COLORS: Record<AcademicProgressStatus, string> = {
  ON_TRACK: "#10b981",
  SLIGHTLY_BEHIND: "#f59e0b",
  BEHIND: "#f97316",
  CRITICAL_DELAY: "#ef4444",
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
        <PageHeader title="Beca Tech hoy" />
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
      <PageHeader title="Beca Tech hoy" subtitle={`Periodo actual: ${o.currentPeriod}`} />

      {/* Row 1 — program health KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Becarios activos" value={fmtInt(o.activeScholars)} sub={`${fmtInt(o.totalScholars)} en total`} />
        <KpiCard label="Retención" value={fmtPct(o.retentionRate)} sub={`${fmtInt(o.withdrawnScholars)} retiros`} />
        <KpiCard label="Satisfacción" value="—" sub="Fuente de datos pendiente" />
        <KpiCard label="GPA promedio" value={fmtGpa(o.averageGpa)} sub="Escala 0–5" />
      </div>

      {/* Row 2 — program composition KPIs */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Colombia / Perú"
          value={`${fmtInt(home.scholarsByCountry.colombia)} / ${fmtInt(home.scholarsByCountry.peru)}`}
          sub="Activos por país"
        />
        <KpiCard label="% Mujeres" value={womenDisplay} sub="De becarios activos con género registrado" />
        <KpiCard
          label="Cohorte"
          value={home.cohortSpotlight.cohort ?? "—"}
          sub={`${fmtInt(home.cohortSpotlight.count)} becarios activos${filters.cohort ? "" : " (última)"}`}
        />
        <KpiCard
          label="Universidades"
          value={fmtInt(home.activeUniversityCount)}
          sub={
            <span title="Aún no es el conteo oficial de universidades aliadas.">
              Con becarios activos
            </span>
          }
        />
      </div>

      {/* Scholar journey band (orientation only — no per-year metrics until the stage rule lands) */}
      <div className="mt-6">
        <SectionTitle>Trayectoria del programa</SectionTitle>
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            {["Año 1", "Año 2", "Año 3", "Año 4", "Año 5"].map((y) => (
              <span
                key={y}
                className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
              >
                {y}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Años 1–2: acompañamiento académico y psicosocial · Años 3–5: desarrollo profesional
          </p>
        </Card>
      </div>

      {/* Program health band */}
      <div className="mt-6">
        <SectionTitle>Salud del programa</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <PieCard title="Distribución de riesgo" data={riskChartData(o.riskDistribution)} />
          <BarCard title="Avance vs. ritmo esperado" data={progressData} />
        </div>
      </div>

      {/* Executive attention band */}
      <div className="mt-6">
        <SectionTitle>Atención ejecutiva</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/dashboard/tracking?tab=years-1-2" className="block">
            <KpiCard label="Riesgo alto o crítico" value={fmtInt(criticalCount)} sub="Becarios que requieren atención" />
          </Link>
          <Link href="/dashboard/tracking?tab=years-1-2" className="block">
            <KpiCard label="Reportes faltantes" value={fmtInt(missingReportsCount)} sub="Check-in o mentoría del mes" />
          </Link>
          <KpiCard label="Retiros" value={fmtInt(o.withdrawnScholars)} sub="En el grupo seleccionado" />
        </div>
      </div>
    </div>
  );
}
