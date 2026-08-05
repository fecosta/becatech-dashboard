import { describe, expect, it } from "vitest";
import {
  deriveAcademicRiskValue,
  deriveParticipationRiskValue,
  derivePsychosocialRiskValue,
} from "@/lib/risk/derive";

describe("risk derivation (default heuristic)", () => {
  it("derives academic risk from GPA, failed subjects, and progress (max)", () => {
    expect(deriveAcademicRiskValue({ gpa: 4.5, failedSubjectsCount: 0 })).toBe(0);
    expect(deriveAcademicRiskValue({ gpa: 2.0 })).toBe(4);
    expect(deriveAcademicRiskValue({ gpa: 4.5, failedSubjectsCount: 3 })).toBe(3);
    expect(deriveAcademicRiskValue({ gpa: 4.5, expectedProgressStatus: "CRITICAL_DELAY" })).toBe(3);
    // A present-but-zero signal is a real 0, not absence.
    expect(deriveAcademicRiskValue({ failedSubjectsCount: 0 })).toBe(0);
    // No academic signal at all → not assessed (null), NOT a fabricated low-risk 0.
    expect(deriveAcademicRiskValue({})).toBeNull();
  });

  it("scales the GPA band to the scholar's own country (Colombia 0-5 vs Peru 0-20)", () => {
    // 17/20 = 85%, equivalent to Colombia's 4.25/5 — same band (0) as a strong Colombia GPA.
    expect(deriveAcademicRiskValue({ gpa: 17, country: "PERU" })).toBe(0);
    // 8/20 = 40%, equivalent to Colombia's 2.0/5 — same band (4) as a failing Colombia GPA, even
    // though 8 alone would look "fine" under Colombia's absolute 0-5 thresholds.
    expect(deriveAcademicRiskValue({ gpa: 8, country: "PERU" })).toBe(4);
    // Omitting country falls back to Colombia's scale, unchanged from before this field existed.
    expect(deriveAcademicRiskValue({ gpa: 4.5 })).toBe(deriveAcademicRiskValue({ gpa: 4.5, country: "COLOMBIA" }));
  });

  it("derives psychosocial risk from check-in and mentor signals (accent-tolerant)", () => {
    expect(derivePsychosocialRiskValue({ checkinFinalStatus: "En riesgo" })).toBe(3);
    expect(derivePsychosocialRiskValue({ checkinFinalStatus: "Requiere seguimiento" })).toBe(2);
    expect(derivePsychosocialRiskValue({ checkinFinalStatus: "Estable" })).toBe(0);
    expect(derivePsychosocialRiskValue({ mentorPermanenceRisk: "Alto" })).toBe(3);
    expect(derivePsychosocialRiskValue({ mentorPsychosocialStatus: "En observación" })).toBe(2);
    // No psychosocial signal at all → not assessed (null), NOT a fabricated low-risk 0.
    expect(derivePsychosocialRiskValue({})).toBeNull();
  });

  it("derives participation risk inversely from activity count", () => {
    // A present zero (the month happened, nothing attended) is a real 4.
    expect(deriveParticipationRiskValue(0)).toBe(4);
    expect(deriveParticipationRiskValue(1)).toBe(3);
    expect(deriveParticipationRiskValue(3)).toBe(2);
    expect(deriveParticipationRiskValue(5)).toBe(1);
    expect(deriveParticipationRiskValue(8)).toBe(0);
    // No support-activity rows at all → not assessed (null), NEVER 0→4→CRITICO. This is the fix.
    expect(deriveParticipationRiskValue(null)).toBeNull();
  });
});
