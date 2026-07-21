import { FeaturePlaceholder } from "@/components/FeaturePlaceholder";
import { AccessDenied, PageHeader } from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

// Temporary gating: same permission as the tracking pages (VIEW_SCHOLAR_TRACKING). A
// dedicated Program Ecosystem permission arrives with Phase 3, once real University/
// Operator content exists.
export default async function ProgramEcosystemPage() {
  const { allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Program Ecosystem" tag="Partners" />
        <AccessDenied />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Program Ecosystem — Universities &amp; Operators"
        tag="Partners"
        subtitle="Who helps us deliver this, and how well? Partner universities, delivery operators, and the stories behind the numbers."
      />
      <FeaturePlaceholder
        title="Program Ecosystem — Universities &amp; Operators"
        description="This will show the program ecosystem: partner universities and delivery operators. There is no real data to display yet."
        pendingOn={["University and Operator data models (Phase 3)"]}
        futureIncludes={[
          "Partner universities: active scholars, GPA, retention, risk, academic calendar and exam periods",
          "Operators: assigned scholars, survey scores, participation, response time and quality indicators",
          "Featured story: a scholar testimonial (editorial content)",
        ]}
      />
    </div>
  );
}
