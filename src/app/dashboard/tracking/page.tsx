import { redirect } from "next/navigation";
import { preserveParams, type SearchParams } from "@/lib/dashboard/filters";

// Deprecated route. The old tracking workspace and its query-param tabs were promoted
// to top-level pages (Beca Tech+ IA). Map each old tab to its new destination, drop the
// now-meaningless `tab` param, and preserve filters. Targets enforce their own guards.
const TAB_DESTINATION: Record<string, string> = {
  summary: "/dashboard",
  "years-1-2": "/dashboard/early-support",
  "years-3-5": "/dashboard/career-readiness",
  scholars: "/dashboard/scholars",
};

export default async function TrackingRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tab, ...rest } = await searchParams;
  const key = Array.isArray(tab) ? tab[0] : tab;
  const destination = TAB_DESTINATION[key ?? ""] ?? "/dashboard";
  const qs = preserveParams(rest);
  redirect(qs ? `${destination}?${qs}` : destination);
}
