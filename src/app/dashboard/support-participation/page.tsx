import Link from "next/link";
import { BarCard } from "@/components/charts";
import { Column, DataTable } from "@/components/DataTable";
import { AccessDenied, KpiCard, PageHeader } from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { getSupportParticipation } from "@/lib/dashboard/queries";
import type { LowParticipationRow } from "@/lib/dashboard/types";
import { fmtInt, fmtPct } from "@/lib/format";
import { ACTIVITY_TYPE_LABEL, COUNTRY_LABEL, RISK_LEVEL_HEX, RISK_LEVEL_LABEL } from "@/lib/labels";

export default async function SupportParticipationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Participación en apoyo" />
        <AccessDenied />
      </div>
    );
  }

  const filters = parseFilters(await searchParams);
  const s = await getSupportParticipation(filters);

  const byType = s.byActivityType.map((t) => ({
    name: ACTIVITY_TYPE_LABEL[t.activityType],
    value: t.totalActivities,
  }));
  const byMonth = s.byMonth.map((m) => ({ name: m.period, value: m.totalActivities }));
  const byRisk = s.byRiskLevel.map((r) => ({
    name: RISK_LEVEL_LABEL[r.riskLevel],
    value: r.averageActivitiesPerScholar,
    color: RISK_LEVEL_HEX[r.riskLevel],
  }));

  const columns: Column<LowParticipationRow>[] = [
    {
      header: "Becario",
      cell: (r) => (
        <Link href={`/dashboard/scholars/${r.scholarId}`} className="font-medium text-blue-700 hover:underline">
          {r.fullName}
          <span className="ml-1 text-xs text-slate-400">{r.scholarId}</span>
        </Link>
      ),
    },
    { header: "País / Cohorte", cell: (r) => `${COUNTRY_LABEL[r.country]} · ${r.cohort}` },
    { header: "Universidad", cell: (r) => r.university },
    { header: "Actividades", cell: (r) => r.totalActivities },
  ];

  return (
    <div>
      <PageHeader title="Participación en apoyo" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Tasa de participación" value={fmtPct(s.participationRate)} sub="Activos con >3 actividades" />
        <KpiCard label="Becarios alto riesgo con apoyo" value={fmtInt(s.highRiskSupport.scholarCount)} />
        <KpiCard label="Actividades (alto riesgo)" value={fmtInt(s.highRiskSupport.totalActivities)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <BarCard title="Participación por tipo de actividad" data={byType} horizontal />
        <BarCard title="Participación por mes" data={byMonth} color="#14b8a6" />
        <BarCard title="Promedio de actividades por nivel de riesgo" data={byRisk} />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Baja participación</h2>
        <DataTable columns={columns} rows={s.lowParticipationScholars} empty="Sin becarios de baja participación" />
      </div>
    </div>
  );
}
