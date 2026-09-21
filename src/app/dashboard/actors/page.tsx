import type { Country } from "@/generated/prisma/enums";
import { UniversityCard } from "@/components/UniversityCard";
import {
  AccessDenied,
  Card,
  CountryGroupTitle,
  HeroStat,
  PageHeader,
  SectionTitle,
} from "@/components/ui";
import { SectionNav } from "@/components/SectionNav";
import { Permission } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/guard";
import { parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { getProgramEcosystem } from "@/lib/dashboard/queries";
import { COUNTRY_LABEL, COUNTRY_TONE } from "@/lib/labels";
import { fmtInt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProgramEcosystemPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, allowed } = await requirePermission(Permission.VIEW_SCHOLAR_TRACKING);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Program Ecosystem" tag="Partners" />
        <AccessDenied />
      </div>
    );
  }

  const sp = await searchParams;
  const filters = parseFilters(sp);
  const eco = await getProgramEcosystem(filters);

  // Both sections group by country, following the design; COUNTRY_TONE keeps the group
  // rules, the card borders and the per-country accents in agreement.
  const byCountry = <T extends { country: Country }>(rows: T[]) =>
    (["COLOMBIA", "PERU"] as const)
      .map((c) => ({ country: c, rows: rows.filter((r) => r.country === c) }))
      .filter((g) => g.rows.length > 0);

  const universityGroups = byCountry(eco.universities);

  const countrySplit = (groups: { country: Country; rows: unknown[] }[], noun: string) =>
    groups.map((g) => `${g.rows.length} ${COUNTRY_LABEL[g.country]}`).join(", ") || `No ${noun}`;

  return (
    <div>
      <PageHeader
        title="Program Ecosystem — Universities &amp; Operating Partners"
        tag="Partners"
        subtitle="Who helps us deliver this, and how well? Partner universities and operating partners across Colombia and Peru."
      />

      <SectionTitle size="lg" id="ecosystem-sec-1">
        1 · Partner Universities
      </SectionTitle>
      <HeroStat
        value={eco.universities.length}
        label={`Partner universities · ${countrySplit(universityGroups, "universities")}`}
        tone="purple"
      />
      {universityGroups.map((g) => (
        <div key={g.country}>
          <CountryGroupTitle tone={COUNTRY_TONE[g.country]}>
            {COUNTRY_LABEL[g.country]} · {g.rows.length}{" "}
            {g.rows.length === 1 ? "university" : "universities"}
          </CountryGroupTitle>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {g.rows.map((u) => (
              <UniversityCard
                key={u.universityId}
                name={u.name}
                city={u.city}
                country={u.country}
                type={u.type}
                scholarCount={u.scholarCount}
                activeScholarCount={u.activeScholarCount}
                dropOutCount={u.dropOutCount}
                cohorts={u.cohorts}
                semesterStartDate={u.semesterStartDate}
                semesterEndDate={u.semesterEndDate}
                examWindowStart={u.examWindowStart}
                examWindowEnd={u.examWindowEnd}
              />
            ))}
          </div>
        </div>
      ))}

      {/* One question, answered plainly: who are the operators, and how many scholars is
          each supporting right now (SPEC-004 §11)? The whole operator catalog is listed —
          country grouping, the operator-count hero and the track badges are gone — so a
          filtered count of 0 still shows its row instead of the operator disappearing. */}
      <SectionTitle size="lg" id="ecosystem-sec-2">
        2 · Operating Partners
      </SectionTitle>
      <Card padded={false}>
        {eco.operators.length === 0 ? (
          <p className="p-4 text-sm text-muted">No operating partners on record.</p>
        ) : (
          <ul className="divide-y divide-border">
            {eco.operators.map((o) => (
              <li
                key={o.operatorId}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
              >
                <span className="text-sm font-bold text-surface-dark">{o.name}</span>
                <span className="text-sm text-muted">
                  <b className="text-surface-dark">{fmtInt(o.scholarCount)}</b>{" "}
                  {o.scholarCount === 1 ? "scholar" : "scholars"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {eco.scholarsWithoutOperator > 0 ? (
        <p className="mt-2.5 text-[12.5px] text-muted">
          {fmtInt(eco.scholarsWithoutOperator)} scholar
          {eco.scholarsWithoutOperator === 1 ? " in" : "s in"} this selection{" "}
          {eco.scholarsWithoutOperator === 1 ? "has" : "have"} no operator recorded, so these
          counts cover assigned scholars rather than everyone in scope. Assignment is never
          inferred from country, cohort, university, or program stage.
        </p>
      ) : null}
      <p className="mt-2.5 text-[12.5px] text-muted">
        Years 1–2 (Early Support) and Year 3 onward (Growth &amp; Development) are delivered by
        different operating partners in each country.
      </p>

      <SectionNav current="/dashboard/actors" sp={sp} user={user} />
    </div>
  );
}
