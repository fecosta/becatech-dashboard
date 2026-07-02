import { BarCard, PieCard } from "@/components/charts";
import { KpiCard, PageHeader } from "@/components/ui";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { getExecutiveOverview } from "@/lib/dashboard/queries";
import { riskChartData } from "@/lib/dashboard/view-helpers";
import { fmtGpa, fmtInt, fmtPct, fmtUsd } from "@/lib/format";

export default async function ExecutiveOverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseFilters(await searchParams);
  const o = await getExecutiveOverview(filters);

  const statusData = [
    { name: "Activos", value: o.activeScholars, color: "#10b981" },
    { name: "Retirados", value: o.withdrawnScholars, color: "#ef4444" },
    { name: "En pausa", value: o.pausedScholars, color: "#f59e0b" },
    { name: "Graduados", value: o.graduatedScholars, color: "#3b82f6" },
  ];

  return (
    <div>
      <PageHeader title="Resumen ejecutivo" subtitle={`Periodo actual: ${o.currentPeriod}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Becarios activos" value={fmtInt(o.activeScholars)} sub={`${fmtInt(o.totalScholars)} en total`} />
        <KpiCard label="Retención" value={fmtPct(o.retentionRate)} sub={`${fmtInt(o.withdrawnScholars)} retiros`} />
        <KpiCard label="GPA promedio" value={fmtGpa(o.averageGpa)} sub="Escala 0–5" />
        <KpiCard label="Participación" value={fmtPct(o.participationRate)} sub="Activos con apoyo" />
        <KpiCard label="Requieren atención" value={fmtInt(o.scholarsNeedingAttention)} sub="Riesgo medio+ o reporte faltante" />
        <KpiCard label="Costo / activo" value={fmtUsd(o.costPerActiveScholarUsd)} sub="USD (aprox.)" />
        <KpiCard label="Costo / retenido" value={fmtUsd(o.costPerRetainedScholarUsd)} sub="USD (aprox.)" />
        <KpiCard label="Costo directo total" value={fmtUsd(o.totalDirectCostUsd)} sub="USD (aprox.)" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <PieCard title="Distribución de riesgo" data={riskChartData(o.riskDistribution)} />
        <BarCard title="Estado en el programa" data={statusData} />
      </div>
    </div>
  );
}
