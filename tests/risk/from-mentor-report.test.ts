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
      semester: "2026-1",
      reportingMonth: "MES 1",
      mentorReportedGlobalStatus: "RIESGO ALTO",
      academicStatus: "ALTO",
      psychosocialStatus: "SIN ALERTAS",
    });
    expect(risk?.period).toBe("MES 1");
    expect(risk?.semester).toBe("2026-1");
    expect(risk?.globalRiskLevel).toBe("RIESGO_ALTO");
    expect(risk?.globalRiskValue).toBe(3);
    expect(risk?.academicRiskLevel).toBe("RIESGO_ALTO"); // "ALTO" axis
    expect(risk?.psychosocialRiskLevel).toBe("SIN_RIESGO"); // "SIN ALERTAS"
    expect(risk?.source).toBe("mentor-report");
    expect(risk?.assessmentComplete).toBe(true);
    expect(risk?.alertType).toBe("ACADEMIC"); // academic axis is the sole max driver
  });

  it("returns null when GLOBAL STATUS is blank or unrecognized (unclassified scholar-month)", () => {
    expect(
      mentorReportToRisk({ ...base, semester: "2026-1", reportingMonth: "MES 1", mentorReportedGlobalStatus: "" }),
    ).toBeNull();
    expect(
      mentorReportToRisk({ ...base, semester: "2026-1", reportingMonth: "MES 1", mentorReportedGlobalStatus: "??" }),
    ).toBeNull();
    expect(mentorReportToRisk({ ...base, semester: "2026-1", reportingMonth: "MES 1" })).toBeNull();
  });

  it("keys risk by a calendar-month period as-is when the month isn't a MES label", () => {
    const r = mentorReportToRisk({
      ...base,
      semester: "2026-1",
      reportingMonth: "2026-02",
      mentorReportedGlobalStatus: "SIN RIESGO",
    });
    expect(r?.period).toBe("2026-02");
    expect(r?.globalRiskLevel).toBe("SIN_RIESGO");
  });

  it("returns null only when there is no reporting month at all", () => {
    expect(mentorReportToRisk({ ...base, semester: "2026-1", mentorReportedGlobalStatus: "SIN RIESGO" })).toBeNull();
    expect(
      mentorReportToRisk({
        ...base,
        semester: "2026-1",
        reportingMonth: "  ",
        mentorReportedGlobalStatus: "SIN RIESGO",
      }),
    ).toBeNull();
  });

  it("still creates a risk row with a null semester when semester can't be determined (graceful degradation)", () => {
    // See docs/adr/008-risk-period-identity.md: MentorReport.semester is an optional sheet column
    // with no working calendar-window fallback for any semester past 2026-1, so refusing to
    // classify a scholar-month over a missing semester would drop it from every risk dashboard
    // instead of merely leaving it unable to disambiguate against another semester's same MES n.
    const risk = mentorReportToRisk({
      ...base,
      reportingMonth: "MES 2",
      mentorReportedGlobalStatus: "RIESGO MEDIO",
    });
    expect(risk).not.toBeNull();
    expect(risk?.period).toBe("MES 2");
    expect(risk?.semester).toBeNull();

    const blank = mentorReportToRisk({
      ...base,
      semester: "   ",
      reportingMonth: "MES 2",
      mentorReportedGlobalStatus: "RIESGO MEDIO",
    });
    expect(blank?.semester).toBeNull();
  });
});
