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
    expect(deriveAcademicRiskValue({})).toBe(0);
  });

  it("derives psychosocial risk from check-in and mentor signals (accent-tolerant)", () => {
    expect(derivePsychosocialRiskValue({ checkinFinalStatus: "En riesgo" })).toBe(3);
    expect(derivePsychosocialRiskValue({ checkinFinalStatus: "Requiere seguimiento" })).toBe(2);
    expect(derivePsychosocialRiskValue({ checkinFinalStatus: "Estable" })).toBe(0);
    expect(derivePsychosocialRiskValue({ mentorPermanenceRisk: "Alto" })).toBe(3);
    expect(derivePsychosocialRiskValue({ mentorPsychosocialStatus: "En observación" })).toBe(2);
    expect(derivePsychosocialRiskValue({})).toBe(0);
  });

  it("derives participation risk inversely from activity count", () => {
    expect(deriveParticipationRiskValue(0)).toBe(4);
    expect(deriveParticipationRiskValue(1)).toBe(3);
    expect(deriveParticipationRiskValue(3)).toBe(2);
    expect(deriveParticipationRiskValue(5)).toBe(1);
    expect(deriveParticipationRiskValue(8)).toBe(0);
  });
});
