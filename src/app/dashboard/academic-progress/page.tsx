import { redirect } from "next/navigation";
import { preserveParams, type SearchParams } from "@/lib/dashboard/filters";

// Deprecated route → Home (program-wide overview), filters preserved. The target
// enforces its own VIEW_DASHBOARD guard.
export default async function AcademicProgressRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const qs = preserveParams(sp);
  redirect(qs ? `/dashboard?${qs}` : "/dashboard");
}
