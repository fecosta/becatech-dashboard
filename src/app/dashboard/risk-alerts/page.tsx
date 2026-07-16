import { redirect } from "next/navigation";
import { preserveParams, type SearchParams } from "@/lib/dashboard/filters";

// Deprecated route → Seguimiento (Años 1–2 = "scholars needing attention"), filters preserved.
// The target route enforces its own VIEW_SCHOLAR_TRACKING guard, so this doesn't bypass access.
export default async function RiskAlertsRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  redirect(`/dashboard/tracking?${preserveParams(sp, { tab: "years-1-2" })}`);
}
