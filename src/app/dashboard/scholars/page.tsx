import Link from "next/link";
import { redirect } from "next/navigation";
import { ExecTable, type ExecRow } from "@/components/ExecTable";
import { ScholarSectionTabs } from "@/components/ScholarSectionTabs";
import { AccessDenied, Card, PageHeader, RiskBadge, SectionTitle } from "@/components/ui";
import { SectionNav } from "@/components/SectionNav";
import { type CurrentUser, Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, preserveParams, type SearchParams } from "@/lib/dashboard/filters";
import { getContactPriority } from "@/lib/dashboard/queries";
import { SCHOLAR_SECTION, scholarProfileHref } from "@/lib/dashboard/scholar-routes";
import type { DashboardFilters } from "@/lib/dashboard/types";

export const dynamic = "force-dynamic";

export default async function ContactPrioritisationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Contact Prioritisation" tag="Scholar Profile" />
        <AccessDenied />
      </div>
    );
  }

  const sp = await searchParams;

  // Legacy links: search used to live on this route as `?q=`, and the old
  // /dashboard/scholars/[scholarId] stub bounced through it. Send those to Find a Scholar
  // rather than dropping the term silently.
  if (sp.q) redirect(`${SCHOLAR_SECTION.find.href}?${preserveParams(sp)}`);

  const filters = parseFilters(sp);

  return (
    <div>
      <PageHeader
        title="Contact Prioritisation"
        tag="Scholar Profile"
        subtitle="Who needs reaching first, and how to reach them. Open a scholar to see their full record."
      />

      <ScholarSectionTabs active="contact" sp={sp} />

      <SectionTitle size="lg" id="profile-sec-1">
        1 · Contact Prioritisation
      </SectionTitle>
      <p className="mb-3.5 text-sm text-muted">
        Scholars at medium risk or above, highest risk first, with how to reach them.
      </p>
      <ContactPriority filters={filters} sp={sp} user={user!} />

      <SectionNav current={SCHOLAR_SECTION.contact.href} sp={sp} user={user} />
    </div>
  );
}

/**
 * Contact list for the scholars who need reaching first.
 *
 * Access-scoped like every other scholar read — this is the only view that shows
 * personal email addresses and phone numbers, so an out-of-scope row here would be a
 * genuine leak rather than a cosmetic bug.
 */
async function ContactPriority({
  filters,
  sp,
  user,
}: {
  filters: DashboardFilters;
  sp: SearchParams;
  user: CurrentUser;
}) {
  const rows = await getContactPriority(filters, user);
  return (
    <Card>
      <ExecTable
        headers={["Scholar", "Email", "Mobile", "University", "Cohort", "Risk"]}
        rows={rows.map<ExecRow>((r) => ({
          key: r.scholarId,
          label: (
            <Link
              href={scholarProfileHref(r.scholarId, sp)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              {r.fullName}
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
          ),
          cells: [
            r.email ?? <span className="text-muted">—</span>,
            r.mobilePhone ?? <span className="text-muted">—</span>,
            r.university,
            r.cohort,
            <RiskBadge key="risk" level={r.riskLevel} />,
          ],
        }))}
        empty="No scholars at medium risk or above in this selection."
        caption="Combine the filters above to narrow down who to contact first. Selecting a scholar opens their profile in a new tab."
      />
    </Card>
  );
}
