// Scholar identity card for the profile page (Beca Tech+ prototype "Scholar Profile").
// Deliberately omits "Age" — no birth-date field exists in the schema (documented gap).
import type { ProgramStatus, RiskLevel } from "@/generated/prisma/enums";
import { PROGRAM_STATUS_LABEL, RISK_LEVEL_LABEL } from "@/lib/labels";
import { ActivityChip, Card, StatusBadge } from "@/components/ui";

export interface ProfileCardProps {
  fullName: string;
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
}

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
    university,
    cohort,
    academicProgram,
    departmentOrigin,
    currentDepartment,
    currentMunicipality,
    programStatus,
    currentRiskLevel,
    activities,
  } = props;

  const statusText = `${PROGRAM_STATUS_LABEL[programStatus]}${
    currentRiskLevel ? ` · ${RISK_LEVEL_LABEL[currentRiskLevel]}` : ""
  }`;

  return (
    <Card className="flex flex-col gap-[18px] p-[22px] sm:flex-row">
      <div className="h-[78px] w-[78px] shrink-0 rounded-2xl bg-gradient-to-br from-purple to-green" />
      <div className="grid flex-1 grid-cols-1 gap-x-[22px] gap-y-2.5 sm:grid-cols-3">
        <Field label="Name">{fullName}</Field>
        <Field label="University">{university || DASH}</Field>
        <Field label="Cohort">{cohort || DASH}</Field>
        <Field label="Major">{academicProgram || DASH}</Field>
        <Field label="Home Department">{departmentOrigin || DASH}</Field>
        <Field label="Residence">{residence(currentMunicipality, currentDepartment)}</Field>
        <Field label="Status">
          <StatusBadge tone={statusTone(programStatus, currentRiskLevel)}>{statusText}</StatusBadge>
        </Field>
        <Field label="Activities" span>
          {activities.length > 0 ? (
            activities.map((a) => <ActivityChip key={a}>{a}</ActivityChip>)
          ) : (
            <span className="font-normal text-muted">No recent activities on record</span>
          )}
        </Field>
      </div>
    </Card>
  );
}
