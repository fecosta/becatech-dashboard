import { BarCard } from "@/components/charts";
import { AccessDenied, KpiCard, PageHeader } from "@/components/ui";
import type { Country } from "@/generated/prisma/enums";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { getUnitEconomics } from "@/lib/dashboard/queries";
import { fmtInt, fmtUsd } from "@/lib/format";
import { COUNTRY_LABEL } from "@/lib/labels";

export default async function UnitEconomicsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { allowed } = await requirePermission(Permission.VIEW_UNIT_ECONOMICS);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Unit Economics" />
        <AccessDenied />
      </div>
    );
  }

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
      <PageHeader title="Unit Economics" subtitle="Amounts normalized to USD using demo exchange rates." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total direct cost" value={fmtUsd(e.totalDirectCostUsd)} sub="USD (approx.)" />
        <KpiCard label="Total scholarship" value={fmtUsd(e.totalScholarshipUsd)} sub="USD (approx.)" />
        <KpiCard label="Cost / active" value={fmtUsd(e.costPerActiveScholarUsd)} sub={`${fmtInt(e.activeScholars)} active`} />
        <KpiCard label="Cost / retained" value={fmtUsd(e.costPerRetainedScholarUsd)} sub={`${fmtInt(e.retainedScholars)} retained`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <BarCard title="Direct cost by cohort" data={byCohort} color="#6366f1" />
        <BarCard title="Direct cost by country" data={byCountry} color="#0ea5e9" />
      </div>
      <div className="mt-4">
        <BarCard title="Direct cost by university" data={byUniversity} color="#8b5cf6" horizontal />
      </div>
    </div>
  );
}
