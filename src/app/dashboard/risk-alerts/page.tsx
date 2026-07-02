import Link from "next/link";
import { PieCard } from "@/components/charts";
import { Column, DataTable } from "@/components/DataTable";
import { Badge, KpiCard, PageHeader, RiskBadge } from "@/components/ui";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { getRiskAlerts } from "@/lib/dashboard/queries";
import type { RiskAlertRow } from "@/lib/dashboard/types";
import { riskChartData } from "@/lib/dashboard/view-helpers";
import { fmtInt } from "@/lib/format";
import {
  ALERT_TYPE_LABEL,
  COUNTRY_LABEL,
  REVIEW_STATUS_LABEL,
  RISK_CHANGE_LABEL,
} from "@/lib/labels";

export default async function RiskAlertsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseFilters(await searchParams);
  const { currentPeriod, distribution, attentionList } = await getRiskAlerts(filters);

  const columns: Column<RiskAlertRow>[] = [
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
    { header: "Riesgo", cell: (r) => <RiskBadge level={r.globalRiskLevel} /> },
    { header: "Alerta", cell: (r) => ALERT_TYPE_LABEL[r.alertType] },
    {
      header: "Cambio",
      cell: (r) => (r.riskChangeLabel ? RISK_CHANGE_LABEL[r.riskChangeLabel] : "—"),
    },
    { header: "Revisión", cell: (r) => REVIEW_STATUS_LABEL[r.reviewStatus] },
    {
      header: "Faltantes",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.missingCheckin ? <Badge tone="amber">Sin check-in</Badge> : null}
          {r.missingMentorReport ? <Badge tone="red">Sin reporte</Badge> : null}
          {!r.missingCheckin && !r.missingMentorReport ? <span className="text-slate-300">—</span> : null}
        </div>
      ),
    },
    { header: "Mentor", cell: (r) => r.currentMentor ?? "—" },
  ];

  return (
    <div>
      <PageHeader title="Riesgo y alertas" subtitle={`Periodo actual: ${currentPeriod}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Riesgo medio" value={fmtInt(distribution.RIESGO_MEDIO)} />
        <KpiCard label="Riesgo alto" value={fmtInt(distribution.RIESGO_ALTO)} />
        <KpiCard label="Crítico" value={fmtInt(distribution.CRITICO)} />
        <KpiCard label="En lista de atención" value={fmtInt(attentionList.length)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <PieCard title="Distribución de riesgo" data={riskChartData(distribution)} />
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Becarios que requieren atención
          </h2>
          <DataTable columns={columns} rows={attentionList} empty="Sin becarios en riesgo" />
        </div>
      </div>
    </div>
  );
}
