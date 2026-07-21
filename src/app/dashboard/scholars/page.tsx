import { ScholarDirectory } from "@/components/ScholarDirectory";
import { AccessDenied, PageHeader } from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";

export default async function ScholarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Scholars" />
        <AccessDenied />
      </div>
    );
  }

  const sp = await searchParams;
  const filters = parseFilters(sp);
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;

  return (
    <div>
      <PageHeader title="Scholars" subtitle="Search any scholar to open their full record." />
      <ScholarDirectory filters={filters} q={q} />
    </div>
  );
}
