// Scholar identity card, following AUGUST 4's "Identity & Program" panel: an avatar and
// name header, then the fields grouped into Personal / Sociodemographic / Academic
// rather than one flat grid.
//
// Deliberately omits "Age": it is derived from dateOfBirth at query time rather than
// stored, and the design does not ask for it.
import type { Country, ProgramStatus, RiskLevel } from "@/generated/prisma/enums";
import { COUNTRY_LABEL, PROGRAM_STATUS_LABEL, RISK_LEVEL_LABEL } from "@/lib/labels";
import { ActivityChip, Card, ProxyBadge, StatusBadge } from "@/components/ui";
import { programYearFromSemester } from "@/lib/academic/program-year";

export interface ProfileCardProps {
  fullName: string;
  country: Country;
  university: string;
  cohort: string;
  academicProgram: string;
  departmentOrigin: string | null;
  currentDepartment: string | null;
  currentMunicipality: string | null;
  programStatus: ProgramStatus;
  currentRiskLevel: RiskLevel | null;
  /** Distinct recent support-activity labels (latest period). */
  activities: string[];
  currentSemester: number | null;
  /** Latest academic term string (e.g. "2026-1") — distinct from the Year bucket below. */
  latestTerm: string | null;
  gender: string;
  expectedEndDate: Date | null;
  /** Program-declared expected graduation year (col K); falls back to expectedEndDate's year. */
  estimatedGraduationYear: number | null;
  /** Delivery-partner operator name; null renders a pending badge (no operator assigned yet). */
  operatorName: string | null;
  scholarId: string;
  email: string | null;
  mobilePhone: string | null;
}

const YEAR_LABEL = { YEAR_1: "Year 1", YEAR_2: "Year 2", YEAR_3: "Year 3" } as const;

const DASH = "—";

function residence(municipality: string | null, department: string | null): string {
  return [municipality, department].filter(Boolean).join(", ") || DASH;
}

function statusTone(status: ProgramStatus, risk: RiskLevel | null): "green" | "purple" | "amber" | "muted" {
  if (status !== "ACTIVE") return "muted";
  if (risk === "CRITICO" || risk === "RIESGO_ALTO") return "amber";
  if (risk === "RIESGO_MEDIO") return "purple";
  return "green";
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.4px] text-purple">
        {title}
      </div>
      <div className="grid grid-cols-1 gap-x-[22px] gap-y-2.5 sm:grid-cols-3">{children}</div>
    </div>
  );
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <div className="text-[11px] uppercase tracking-[0.03em] text-muted">{label}</div>
      <div className="mt-0.5 text-[13.5px] font-semibold text-surface-dark">{children}</div>
    </div>
  );
}

export function ProfileCard(props: ProfileCardProps) {
  const {
    fullName,
    country,
    university,
    cohort,
    academicProgram,
    departmentOrigin,
    currentDepartment,
    currentMunicipality,
    programStatus,
    currentRiskLevel,
    activities,
    currentSemester,
    latestTerm,
    gender,
    expectedEndDate,
    estimatedGraduationYear,
    operatorName,
    scholarId,
    email,
    mobilePhone,
  } = props;

  const statusText = `${PROGRAM_STATUS_LABEL[programStatus]}${
    currentRiskLevel ? ` · ${RISK_LEVEL_LABEL[currentRiskLevel]}` : ""
  }`;
  const year = programYearFromSemester(currentSemester);

  return (
    <Card className="p-6">
      <div className="mb-[18px] flex flex-wrap items-center gap-5 border-b border-border pb-[18px]">
        <div className="h-[104px] w-[104px] shrink-0 rounded-[22px] bg-linear-to-br from-purple to-green" />
        <div className="min-w-[220px] flex-1">
          <div className="font-display text-2xl font-bold text-surface-dark">{fullName}</div>
          <div className="mt-1 text-[12.5px] text-muted">
            ID {scholarId} · {university || DASH} · {cohort || DASH}
          </div>
        </div>
        <StatusBadge tone={statusTone(programStatus, currentRiskLevel)}>{statusText}</StatusBadge>
      </div>

      <div className="flex flex-col gap-5">
        <Panel title="Personal">
          <Field label="Email">{email || DASH}</Field>
          <Field label="Mobile">{mobilePhone || DASH}</Field>
        </Panel>
        <Panel title="Sociodemographic">
          <Field label="Country">{COUNTRY_LABEL[country]}</Field>
          <Field label="Gender">{gender || DASH}</Field>
          <Field label="Department of Origin">{departmentOrigin || DASH}</Field>
          <Field label="Department of Residence">
            {residence(currentMunicipality, currentDepartment)}
          </Field>
        </Panel>
        <Panel title="Academic">
          <Field label="University">{university || DASH}</Field>
          <Field label="Cohort">{cohort || DASH}</Field>
          <Field label="Program">{academicProgram || DASH}</Field>
          <Field label="Year">{year ? YEAR_LABEL[year] : DASH}</Field>
          <Field label="Current Semester">{latestTerm ?? DASH}</Field>
          <Field label="Est. Year of Finalization">
            {estimatedGraduationYear ??
              (expectedEndDate ? new Date(expectedEndDate).getFullYear() : DASH)}
          </Field>
          <Field label="Delivery Partner">
            {operatorName ?? <ProxyBadge>PENDING</ProxyBadge>}
          </Field>
          <Field label="Activities" span>
            {activities.length > 0 ? (
              activities.map((a) => <ActivityChip key={a}>{a}</ActivityChip>)
            ) : (
              <span className="font-normal text-muted">No recent activities on record</span>
            )}
          </Field>
        </Panel>
      </div>
    </Card>
  );
}
