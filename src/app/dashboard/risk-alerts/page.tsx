import { redirect } from "next/navigation";
import { preserveParams, type SearchParams } from "@/lib/dashboard/filters";

// Deprecated route → Early Support (Years 1–2 = "scholars needing attention"), filters
// preserved. The target route enforces its own VIEW_SCHOLAR_TRACKING guard.
export default async function RiskAlertsRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const qs = preserveParams(sp);
  redirect(qs ? `/dashboard/early-support?${qs}` : "/dashboard/early-support");
}
