import { describe, expect, it } from "vitest";
import { mentorReportToRisk, programMonthKey } from "@/lib/risk/from-mentor-report";

// The mentor report's GLOBAL STATUS (col Y) is the authoritative risk classification; it maps
// verbatim to a RiskAssessment keyed by the program month (MES n). Unclassified reports map to null.
const base = { scholarId: "BT-CO-001", submissionId: "s1" } as const;

describe("programMonthKey", () => {
  it("canonicalizes MES labels and rejects non-MES months", () => {
    expect(programMonthKey("MES 1")).toBe("MES 1");
    expect(programMonthKey("  mes  6 ")).toBe("MES 6");
    expect(programMonthKey("2026-02")).toBeNull();
    expect(programMonthKey("")).toBeNull();
    expect(programMonthKey(null)).toBeNull();
  });
});

describe("mentorReportToRisk", () => {
  it("maps GLOBAL STATUS + axes to a RiskAssessment keyed by MES n", () => {
    const risk = mentorReportToRisk({
      ...base,
      reportingMonth: "MES 1",
      mentorReportedGlobalStatus: "RIESGO ALTO",
      academicStatus: "ALTO",
      psychosocialStatus: "SIN ALERTAS",
    });
    expect(risk?.period).toBe("MES 1");
    expect(risk?.globalRiskLevel).toBe("RIESGO_ALTO");
    expect(risk?.globalRiskValue).toBe(3);
    expect(risk?.academicRiskLevel).toBe("RIESGO_ALTO"); // "ALTO" axis
    expect(risk?.psychosocialRiskLevel).toBe("SIN_RIESGO"); // "SIN ALERTAS"
    expect(risk?.source).toBe("mentor-report");
    expect(risk?.assessmentComplete).toBe(true);
    expect(risk?.alertType).toBe("ACADEMIC"); // academic axis is the sole max driver
  });

  it("returns null when GLOBAL STATUS is blank or unrecognized (unclassified scholar-month)", () => {
    expect(mentorReportToRisk({ ...base, reportingMonth: "MES 1", mentorReportedGlobalStatus: "" })).toBeNull();
    expect(mentorReportToRisk({ ...base, reportingMonth: "MES 1", mentorReportedGlobalStatus: "??" })).toBeNull();
    expect(mentorReportToRisk({ ...base, reportingMonth: "MES 1" })).toBeNull();
  });

  it("keys risk by a calendar-month period as-is when the month isn't a MES label", () => {
    const r = mentorReportToRisk({
      ...base,
      reportingMonth: "2026-02",
      mentorReportedGlobalStatus: "SIN RIESGO",
    });
    expect(r?.period).toBe("2026-02");
    expect(r?.globalRiskLevel).toBe("SIN_RIESGO");
  });

  it("returns null only when there is no reporting month at all", () => {
    expect(mentorReportToRisk({ ...base, mentorReportedGlobalStatus: "SIN RIESGO" })).toBeNull();
    expect(mentorReportToRisk({ ...base, reportingMonth: "  ", mentorReportedGlobalStatus: "SIN RIESGO" })).toBeNull();
  });
});
