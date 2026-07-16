import { redirect } from "next/navigation";
import { preserveParams, type SearchParams } from "@/lib/dashboard/filters";

// Deprecated route → Seguimiento › Resumen (until dedicated stage tabs exist), filters
// preserved. The target enforces its own VIEW_SCHOLAR_TRACKING guard.
export default async function SupportParticipationRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  redirect(`/dashboard/tracking?${preserveParams(sp, { tab: "summary" })}`);
}
