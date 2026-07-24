// Partner-university card (Program Ecosystem) — country-colored left border (purple =
// Colombia, green = Peru, matching the mockup), scholar counts, risk mix, and
// semester/exam dates from the University model.
import type { Country, UniversityType } from "@/generated/prisma/enums";
import { Card, ProxyBadge } from "@/components/ui";
import { RiskBar } from "@/components/RiskBar";
import type { RiskDistribution } from "@/lib/dashboard/types";

const TYPE_LABEL: Record<UniversityType, string> = { PUBLIC: "Public", PRIVATE: "Private" };
const COUNTRY_ABBR: Record<Country, string> = { COLOMBIA: "COL", PERU: "PE" };
const BORDER_CLASS: Record<Country, string> = {
  COLOMBIA: "border-l-4 border-l-purple",
  PERU: "border-l-4 border-l-green",
};
const VALUE_CLASS: Record<Country, string> = { COLOMBIA: "text-purple", PERU: "text-green" };

const fmtShortDate = (d: Date | string | null): string =>
  d ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d)) : "—";

export function UniversityCard({
  name,
  city,
  country,
  type,
  scholarCount,
  activeScholarCount,
  dropOutCount,
  riskDistribution,
  semesterStartDate,
  semesterEndDate,
  examWindowStart,
  examWindowEnd,
}: {
  name: string;
  city: string;
  country: Country;
  type: UniversityType;
  scholarCount: number;
  activeScholarCount: number;
  dropOutCount: number;
  riskDistribution: RiskDistribution;
  semesterStartDate: Date | string | null;
  semesterEndDate: Date | string | null;
  examWindowStart: Date | string | null;
  examWindowEnd: Date | string | null;
}) {
  return (
    <Card className={BORDER_CLASS[country]}>
      <div className="mb-2 text-[14.5px] font-bold leading-snug text-surface-dark">
        {name}{" "}
        <span className="text-[11px] font-normal text-muted">
          {city}, {COUNTRY_ABBR[country]} · {TYPE_LABEL[type]}
        </span>
      </div>
      <div className={`mb-1 text-sm font-bold ${VALUE_CLASS[country]}`}>
        {activeScholarCount} active scholars
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted">
        <span>
          {activeScholarCount} active · {dropOutCount} drop out
        </span>
        {scholarCount === 0 ? null : (
          <>
            <span>
              Semester: {fmtShortDate(semesterStartDate)} – {fmtShortDate(semesterEndDate)}
            </span>
            <span>
              Exams: {fmtShortDate(examWindowStart)} – {fmtShortDate(examWindowEnd)}
            </span>
          </>
        )}
      </div>
      {scholarCount > 0 ? (
        <div className="mt-3">
          <RiskBar distribution={riskDistribution} />
        </div>
      ) : null}
      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted">
        Evaluation results <ProxyBadge>PENDING</ProxyBadge>
      </div>
    </Card>
  );
}
