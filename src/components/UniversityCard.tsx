// Partner-university card (Program Ecosystem), per design-reference/MVP_Dashboard
// AUGUST 4.html: name + type badge on the head row, a bordered location line, three
// compact count chips, then a bordered-top meta block.
//
// The country-colored left border (purple = Colombia, green = Peru) follows
// COUNTRY_TONE, shared with the ecosystem group headings.
import type { Country, UniversityType } from "@/generated/prisma/enums";
import { Card, StatChip, TypeBadge } from "@/components/ui";
import { COUNTRY_LABEL, COUNTRY_TONE } from "@/lib/labels";

const TYPE_LABEL: Record<UniversityType, string> = { PUBLIC: "Public", PRIVATE: "Private" };
const BORDER_CLASS: Record<"purple" | "green", string> = {
  purple: "border-l-4 border-l-purple",
  green: "border-l-4 border-l-green",
};

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
  cohorts,
  semesterStartDate,
  semesterEndDate,
  examWindowStart,
  examWindowEnd,
}: {
  name: string;
  city: string;
  country: Country;
  type: UniversityType;
  /** Everyone ever enrolled here — a superset of active + dropout. */
  scholarCount: number;
  activeScholarCount: number;
  dropOutCount: number;
  cohorts: string[];
  semesterStartDate: Date | string | null;
  semesterEndDate: Date | string | null;
  examWindowStart: Date | string | null;
  examWindowEnd: Date | string | null;
}) {
  // Retention is over the settled population (active + withdrawn); scholars who are
  // paused or graduated are not a retention outcome either way.
  const settled = activeScholarCount + dropOutCount;
  const retentionPct = settled ? Math.round((activeScholarCount / settled) * 100) : null;
  const hasScholars = scholarCount > 0;

  return (
    <Card className={`${BORDER_CLASS[COUNTRY_TONE[country]]} p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-extrabold leading-tight text-surface-dark">{name}</div>
        <TypeBadge tone={type === "PUBLIC" ? "mint" : "lavender"}>{TYPE_LABEL[type]}</TypeBadge>
      </div>
      <div className="mb-3 mt-1 border-b border-border pb-[11px] text-[11px] text-muted">
        {city}, {COUNTRY_LABEL[country]}
      </div>

      <div className="mb-2.5 flex gap-1.5">
        <StatChip size="sm" value={scholarCount} label="Enrolled to date" />
        <StatChip size="sm" value={activeScholarCount} label="Active" tone="green" />
        <StatChip
          size="sm"
          value={dropOutCount}
          label="Dropout"
          tone={dropOutCount > 0 ? "red" : "default"}
        />
      </div>

      {hasScholars ? (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2.5 text-[11px] text-muted">
          <span>
            {cohorts.length > 0 ? (
              <>
                <b className="font-bold text-ink">Cohorts</b> {cohorts.join(", ")}
                {retentionPct != null ? " · " : null}
              </>
            ) : null}
            {retentionPct != null ? (
              <>
                <b className="font-bold text-ink">Retention</b> {retentionPct}% /{" "}
                <b className="font-bold text-ink">Dropout</b> {100 - retentionPct}%
              </>
            ) : null}
          </span>
          <span>
            <b className="font-bold text-ink">Semester</b> {fmtShortDate(semesterStartDate)} –{" "}
            {fmtShortDate(semesterEndDate)} · exams {fmtShortDate(examWindowStart)} –{" "}
            {fmtShortDate(examWindowEnd)}
          </span>
        </div>
      ) : null}
    </Card>
  );
}
