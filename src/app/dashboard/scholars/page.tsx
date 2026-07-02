import Link from "next/link";
import { Column, DataTable } from "@/components/DataTable";
import { ScholarSearch } from "@/components/ScholarSearch";
import { Badge, PageHeader, RiskBadge } from "@/components/ui";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { getScholarDirectory } from "@/lib/dashboard/queries";
import type { ScholarDirectoryRow } from "@/lib/dashboard/types";
import { fmtGpa } from "@/lib/format";
import { COUNTRY_LABEL, PROGRAM_STATUS_LABEL } from "@/lib/labels";
import type { ProgramStatus } from "@/generated/prisma/enums";

const STATUS_TONE: Record<ProgramStatus, "green" | "red" | "amber" | "blue"> = {
  ACTIVE: "green",
  WITHDRAWN: "red",
  PAUSED: "amber",
  GRADUATED: "blue",
};

export default async function ScholarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const rows = await getScholarDirectory(filters, q);

  const columns: Column<ScholarDirectoryRow>[] = [
    {
      header: "Becario",
      cell: (r) => (
        <Link href={`/dashboard/scholars/${r.scholarId}`} className="font-medium text-blue-700 hover:underline">
          {r.fullName}
          <span className="ml-1 text-xs text-slate-400">{r.scholarId}</span>
        </Link>
      ),
    },
    { header: "País", cell: (r) => COUNTRY_LABEL[r.country] },
    { header: "Cohorte", cell: (r) => r.cohort },
    { header: "Universidad", cell: (r) => r.university },
    { header: "Programa", cell: (r) => r.academicProgram },
    {
      header: "Estado",
      cell: (r) => <Badge tone={STATUS_TONE[r.programStatus]}>{PROGRAM_STATUS_LABEL[r.programStatus]}</Badge>,
    },
    {
      header: "Riesgo",
      cell: (r) => (r.currentRiskLevel ? <RiskBadge level={r.currentRiskLevel} /> : <span className="text-slate-300">—</span>),
    },
    { header: "GPA", cell: (r) => fmtGpa(r.latestGpa) },
  ];

  return (
    <div>
      <PageHeader title="Becarios" subtitle={`${rows.length} becario(s)`} />
      <div className="mb-4">
        <ScholarSearch />
      </div>
      <DataTable columns={columns} rows={rows} empty="No se encontraron becarios" />
    </div>
  );
}
