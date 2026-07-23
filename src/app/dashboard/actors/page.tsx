import { DeliveryPartnerGroup } from "@/components/DeliveryPartnerGroup";
import { UniversityCard } from "@/components/UniversityCard";
import { AccessDenied, Card, PageHeader, SectionTitle } from "@/components/ui";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { getProgramEcosystem } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export default async function ProgramEcosystemPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Program Ecosystem" tag="Partners" />
        <AccessDenied />
      </div>
    );
  }

  const filters = parseFilters(await searchParams);
  const eco = await getProgramEcosystem(filters);

  const earlySupportOperators = eco.operators.filter((o) => o.track === "EARLY_SUPPORT");
  const growthOperators = eco.operators.filter((o) => o.track === "GROWTH_DEVELOPMENT");

  return (
    <div>
      <PageHeader
        title="Program Ecosystem — Universities &amp; Delivery Partners"
        tag="Partners"
        subtitle="Who helps us deliver this, and how well? Partner universities and delivery partners across Colombia and Peru."
      />

      <SectionTitle>Partner Universities</SectionTitle>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {eco.universities.map((u) => (
          <UniversityCard
            key={u.universityId}
            name={u.name}
            city={u.city}
            country={u.country}
            type={u.type}
            scholarCount={u.scholarCount}
            activeScholarCount={u.activeScholarCount}
            dropOutCount={u.dropOutCount}
            riskDistribution={u.riskDistribution}
            semesterStartDate={u.semesterStartDate}
            semesterEndDate={u.semesterEndDate}
            examWindowStart={u.examWindowStart}
            examWindowEnd={u.examWindowEnd}
          />
        ))}
      </div>

      <div className="mt-6">
        <SectionTitle>Delivery Partners</SectionTitle>
        <Card>
          <DeliveryPartnerGroup
            title="Academic & Psychosocial — Early Support"
            operators={earlySupportOperators}
          />
          <DeliveryPartnerGroup title="Growth & Development" operators={growthOperators} />
        </Card>
      </div>
    </div>
  );
}
