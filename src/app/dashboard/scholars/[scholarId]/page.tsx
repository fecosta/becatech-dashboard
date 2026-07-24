import { redirect } from "next/navigation";
import { preserveParams, type SearchParams } from "@/lib/dashboard/filters";

// Merged into the Scholar Progress search-to-profile view — filters preserved, scholarId
// becomes the `q` param (an exact scholarId match resolves to exactly one directory row,
// so it goes straight to the profile). The target route enforces its own guards
// (VIEW_SCHOLAR_TRACKING, then canAccessScholar once resolved to one scholar).
export default async function ScholarProfileRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ scholarId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { scholarId } = await params;
  const sp = await searchParams;
  const qs = preserveParams(sp, { q: scholarId });
  redirect(`/dashboard/scholars?${qs}`);
}
