// A scholar's own page. Addressed by scholarId (the source's ID_becario, `Scholar`'s @id),
// so it survives a refresh, works pasted into a fresh tab, and depends on no state from
// the two list screens that link here.
import { ScholarProfileView } from "@/components/ScholarProfileView";
import { ScholarSectionTabs } from "@/components/ScholarSectionTabs";
import { AccessDenied, PageHeader } from "@/components/ui";
import { canAccessScholar, Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import type { SearchParams } from "@/lib/dashboard/filters";

export const dynamic = "force-dynamic";

export default async function ScholarProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ scholarId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { user, allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  const { scholarId } = await params;
  const sp = await searchParams;

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Scholar Profile" tag="Individual record" />
        <AccessDenied />
      </div>
    );
  }

  // Per-scholar scope on top of the section permission: a mentor cannot open a scholar they
  // are not assigned to, even by pasting the URL. getScholarProfile re-checks and returns
  // null regardless, so this gate is the message, not the enforcement.
  if (!canAccessScholar(user!, scholarId)) {
    return (
      <div>
        <PageHeader title="Scholar Profile" tag="Individual record" />
        <ScholarSectionTabs sp={sp} />
        <AccessDenied message="You don't have access to this scholar." />
      </div>
    );
  }

  return (
    <div>
      {/* Neither tab is active: this page is in the section but is not a list. Opened in a
          fresh tab it has no history, so these links are the only way back. */}
      <ScholarSectionTabs sp={sp} />
      <ScholarProfileView scholarId={scholarId} user={user} />
    </div>
  );
}
