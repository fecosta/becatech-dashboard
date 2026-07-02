import { BarCard } from "@/components/charts";
import { KpiCard, PageHeader } from "@/components/ui";
import type { Country } from "@/generated/prisma/enums";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { getUnitEconomics } from "@/lib/dashboard/queries";
import { fmtInt, fmtUsd } from "@/lib/format";
import { COUNTRY_LABEL } from "@/lib/labels";

export default async function UnitEconomicsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseFilters(await searchParams);
  const e = await getUnitEconomics(filters);

  const byCohort = e.byCohort.map((c) => ({ name: c.key, value: c.totalUsd }));
  const byCountry = e.byCountry.map((c) => ({
    name: COUNTRY_LABEL[c.key as Country] ?? c.key,
    value: c.totalUsd,
  }));
  const byUniversity = e.byUniversity.map((c) => ({ name: c.key, value: c.totalUsd }));

  return (
    <div>
      <PageHeader title="Costos (unit economics)" subtitle="Montos normalizados a USD con tasas de cambio de demostración." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Costo directo total" value={fmtUsd(e.totalDirectCostUsd)} sub="USD (aprox.)" />
        <KpiCard label="Beca total" value={fmtUsd(e.totalScholarshipUsd)} sub="USD (aprox.)" />
        <KpiCard label="Costo / activo" value={fmtUsd(e.costPerActiveScholarUsd)} sub={`${fmtInt(e.activeScholars)} activos`} />
        <KpiCard label="Costo / retenido" value={fmtUsd(e.costPerRetainedScholarUsd)} sub={`${fmtInt(e.retainedScholars)} retenidos`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <BarCard title="Costo directo por cohorte" data={byCohort} color="#6366f1" />
        <BarCard title="Costo directo por país" data={byCountry} color="#0ea5e9" />
      </div>
      <div className="mt-4">
        <BarCard title="Costo directo por universidad" data={byUniversity} color="#8b5cf6" horizontal />
      </div>
    </div>
  );
}
