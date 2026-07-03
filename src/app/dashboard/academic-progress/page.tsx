import Link from "next/link";
import { BarCard, PieCard } from "@/components/charts";
import { Column, DataTable } from "@/components/DataTable";
import { AccessDenied, KpiCard, PageHeader } from "@/components/ui";
import type { Country } from "@/generated/prisma/enums";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { getAcademicProgress } from "@/lib/dashboard/queries";
import type { BehindRow } from "@/lib/dashboard/types";
import { riskChartData } from "@/lib/dashboard/view-helpers";
import { fmtGpa, fmtInt } from "@/lib/format";
import { COUNTRY_LABEL, PROGRESS_STATUS_LABEL } from "@/lib/labels";

const PROGRESS_COLORS: Record<string, string> = {
  ON_TRACK: "#10b981",
  SLIGHTLY_BEHIND: "#f59e0b",
  BEHIND: "#f97316",
  CRITICAL_DELAY: "#ef4444",
};

export default async function AcademicProgressPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Avance académico" />
        <AccessDenied />
      </div>
    );
  }

  const filters = parseFilters(await searchParams);
  const a = await getAcademicProgress(filters);

  const gpaByCountry = a.gpaByCountry.map((g) => ({
    name: COUNTRY_LABEL[g.key as Country] ?? g.key,
    value: g.averageGpa,
  }));
  const gpaByCohort = a.gpaByCohort.map((g) => ({ name: g.key, value: g.averageGpa }));
  const progressData = Object.entries(a.progressStatusDistribution).map(([status, value]) => ({
    name: PROGRESS_STATUS_LABEL[status as keyof typeof PROGRESS_STATUS_LABEL],
    value,
    color: PROGRESS_COLORS[status],
  }));

  const columns: Column<BehindRow>[] = [
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
    { header: "Término", cell: (r) => r.latestTerm ?? "—" },
    { header: "Avance", cell: (r) => (r.progressPercentage != null ? `${r.progressPercentage}%` : "—") },
    { header: "Estado", cell: (r) => (r.expectedProgressStatus ? PROGRESS_STATUS_LABEL[r.expectedProgressStatus] : "—") },
    { header: "Reprobadas", cell: (r) => r.failedSubjectsCount ?? 0 },
  ];

  return (
    <div>
      <PageHeader title="Avance académico" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="GPA promedio" value={fmtGpa(a.averageGpa)} sub="Escala 0–5" />
        <KpiCard label="Atrasados" value={fmtInt(a.scholarsBehind.length)} sub="Atrasado o atraso crítico" />
        <KpiCard label="Con materias reprobadas" value={fmtInt(a.scholarsWithFailedSubjects)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <BarCard title="GPA por país" data={gpaByCountry} />
        <BarCard title="GPA por cohorte" data={gpaByCohort} />
        <BarCard title="Estado de avance" data={progressData} />
        <PieCard title="Riesgo académico" data={riskChartData(a.academicRiskDistribution)} />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Becarios atrasados</h2>
        <DataTable columns={columns} rows={a.scholarsBehind} empty="Ningún becario atrasado" />
      </div>
    </div>
  );
}
