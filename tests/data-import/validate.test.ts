import { describe, expect, it } from "vitest";
import { templateAdapter } from "@/lib/data-import/adapters/template";
import type { CanonicalBatch, ValidationContext } from "@/lib/data-import/types";
import { validateBatch } from "@/lib/data-import/validate";

function ctx(): ValidationContext {
  return {
    existingScholarIds: new Set(["BT-CO-001"]),
    scholarIdsByNormalizedName: new Map(),
    countryByScholarId: new Map(),
    controls: new Map<string, Set<string>>([
      ["country", new Set(["COLOMBIA", "PERU"])],
      ["program_status", new Set(["ACTIVE", "WITHDRAWN", "GRADUATED", "PAUSED"])],
      ["activity_type", new Set(["INDIVIDUAL_TUTORING", "GROUP_TUTORING", "WORKSHOP", "OTHER"])],
      ["request_status", new Set(["SUBMITTED", "IN_REVIEW", "RESOLVED", "REJECTED", "PENDING"])],
      ["cost_category", new Set(["Tuition", "Scholarship amount"])],
      ["academic_progress_status", new Set(["ON_TRACK", "SLIGHTLY_BEHIND", "BEHIND", "CRITICAL_DELAY"])],
    ]),
    universities: new Map([["u", "uni-test"]]),
    operatorsByName: new Map(),
  };
}

describe("import validation", () => {
  it("accepts a valid academic term for an existing scholar", () => {
    const batch = templateAdapter("ACADEMIC_TERM", [{ scholarId: "BT-CO-001", term: "2025-1", gpa: "4.1" }]);
    const res = validateBatch(batch, ctx());
    expect(res.errorRows).toBe(0);
    expect(res.validated.ACADEMIC_TERM).toHaveLength(1);
  });

  it("builds an academic term with the leveling/deadline fields when supplied", () => {
    const batch = templateAdapter("ACADEMIC_TERM", [
      {
        scholarId: "BT-CO-001",
        term: "2025-1",
        gpa: "4.1",
        delayedSubjects: "Cálculo II",
        levelingAlternative: "Curso de verano",
        maxDeadline: "2025-12-01",
      },
    ]);
    const res = validateBatch(batch, ctx());
    expect(res.errorRows).toBe(0);
    const row = (res.validated.ACADEMIC_TERM ?? [])[0];
    expect(row.delayedSubjects).toBe("Cálculo II");
    expect(row.levelingAlternative).toBe("Curso de verano");
    expect(row.maxDeadline).toBeInstanceOf(Date);
  });

  it("keeps a scholar when an OPTIONAL numeric/date field is malformed (dropped to null, not rejected)", () => {
    const batch = templateAdapter("SCHOLAR", [
      {
        scholarId: "BT-CO-9",
        fullName: "X",
        country: "COLOMBIA",
        cohort: "2025",
        university: "U",
        academicProgram: "CS",
        gender: "Female",
        estimatedGraduationYear: "N/A", // optional int, junk value
        dateOfBirth: "not a date", // optional date, junk value
      },
    ]);
    const res = validateBatch(batch, ctx());
    expect(res.errorRows).toBe(0);
    const row = (res.validated.SCHOLAR ?? [])[0];
    expect(row.estimatedGraduationYear).toBeUndefined();
    expect(row.dateOfBirth).toBeUndefined();
  });

  it("still rejects a REQUIRED field that is malformed (e.g. a required numeric cost)", () => {
    const batch = templateAdapter("FINANCIAL_INPUT", [
      { scholarId: "BT-CO-001", period: "2026", costCategory: "Tuition", costAmount: "abc", currency: "COP" },
    ]);
    const res = validateBatch(batch, ctx());
    expect(res.errors.some((e) => e.field === "costAmount")).toBe(true);
  });

  it("builds a mentor report with semester and the quarantined mentorReportedGlobalStatus field", () => {
    const batch = templateAdapter("MENTOR_REPORT", [
      { scholarId: "BT-CO-001", semester: "5", mentorReportedGlobalStatus: "Estable" },
    ]);
    const res = validateBatch(batch, ctx());
    expect(res.errorRows).toBe(0);
    const row = (res.validated.MENTOR_REPORT ?? [])[0];
    expect(row.semester).toBe("5");
    expect(row.mentorReportedGlobalStatus).toBe("Estable");
  });

  describe("MENTOR_REPORT scholar identity — direct ID vs. name (new sheet has both)", () => {
    function identityCtx(): ValidationContext {
      const context = ctx();
      context.existingScholarIds = new Set(["BT-CO-001"]);
      context.scholarIdsByNormalizedName = new Map([["ana perez gomez", ["BT-CO-001"]]]);
      return context;
    }

    it("accepts a direct scholarId with no scholarName given (manual-template path, unchanged)", () => {
      const batch = templateAdapter("MENTOR_REPORT", [{ scholarId: "BT-CO-001" }]);
      const res = validateBatch(batch, identityCtx());
      expect(res.errorRows).toBe(0);
      expect((res.validated.MENTOR_REPORT ?? [])[0].scholarId).toBe("BT-CO-001");
    });

    it("accepts a direct scholarId and a matching scholarName (both agree)", () => {
      const batch = templateAdapter("MENTOR_REPORT", [
        { scholarId: "BT-CO-001", scholarName: "Ana Pérez Gómez" },
      ]);
      const res = validateBatch(batch, identityCtx());
      expect(res.errorRows).toBe(0);
      expect((res.validated.MENTOR_REPORT ?? [])[0].scholarId).toBe("BT-CO-001");
    });

    it("rejects a direct scholarId that disagrees with the resolved scholarName (never guesses)", () => {
      const context = identityCtx();
      context.existingScholarIds = new Set(["BT-CO-001", "BT-CO-999"]);
      const batch = templateAdapter("MENTOR_REPORT", [
        { scholarId: "BT-CO-999", scholarName: "Ana Pérez Gómez" },
      ]);
      const res = validateBatch(batch, context);
      expect(res.errorRows).toBe(1);
      expect(res.errors[0].field).toBe("scholarId");
      expect(res.errors[0].message).toContain("BT-CO-999");
      expect(res.errors[0].message).toContain("BT-CO-001");
    });

    it("accepts a valid direct scholarId when the given scholarName fails to resolve", () => {
      const batch = templateAdapter("MENTOR_REPORT", [
        { scholarId: "BT-CO-001", scholarName: "Nombre Con Error De Tipeo" },
      ]);
      const res = validateBatch(batch, identityCtx());
      expect(res.errorRows).toBe(0);
      expect((res.validated.MENTOR_REPORT ?? [])[0].scholarId).toBe("BT-CO-001");
    });

    it("rejects when scholarName fails to resolve and there is no valid direct scholarId", () => {
      const batch = templateAdapter("MENTOR_REPORT", [
        { scholarId: "MENTOR-77", scholarName: "Nombre Con Error De Tipeo" },
      ]);
      const res = validateBatch(batch, identityCtx());
      expect(res.errorRows).toBe(1);
      expect(res.errors[0].field).toBe("scholarName");
    });

    it("resolves by name alone when the scholarId cell is entirely blank, not rejected as Required", () => {
      // A real production shape: the mentor left the ID cell empty but filled in the name. Before
      // the checkFields carve-out, this was rejected with a generic "Required" before the name
      // resolution below ever ran.
      const batch = templateAdapter("MENTOR_REPORT", [{ scholarName: "Ana Pérez Gómez" }]);
      const res = validateBatch(batch, identityCtx());
      expect(res.errorRows).toBe(0);
      expect(res.errors).toEqual([]);
      expect((res.validated.MENTOR_REPORT ?? [])[0].scholarId).toBe("BT-CO-001");
    });

    it("still rejects with a specific message (not Required) when both the id and the name fail to resolve", () => {
      const batch = templateAdapter("MENTOR_REPORT", [{ scholarName: "Nombre Con Error De Tipeo" }]);
      const res = validateBatch(batch, identityCtx());
      expect(res.errorRows).toBe(1);
      expect(res.errors[0].field).toBe("scholarName");
      expect(res.errors[0].message).toContain("Scholar not found by name");
    });
  });

  it("flags a missing required field", () => {
    const batch = templateAdapter("ACADEMIC_TERM", [{ scholarId: "BT-CO-001" }]); // no term
    const res = validateBatch(batch, ctx());
    expect(res.errors.some((e) => e.field === "term")).toBe(true);
    expect(res.successRows).toBe(0);
  });

  it("resolves a scholar's operator by name, lookup-only like university", () => {
    const context = ctx();
    context.operatorsByName.set("fundación antivirus para la deserción", "op-antivirus");
    const batch = templateAdapter("SCHOLAR", [
      {
        scholarId: "BT-CO-9",
        fullName: "X",
        country: "COLOMBIA",
        cohort: "2025",
        university: "U",
        academicProgram: "CS",
        gender: "Female",
        operator: "Fundación Antivirus para la Deserción",
      },
    ]);
    const res = validateBatch(batch, context);
    expect(res.errorRows).toBe(0);
    expect((res.validated.SCHOLAR ?? [])[0].operatorId).toBe("op-antivirus");
  });

  it("leaves operatorId null when no operator is supplied (nullable, unlike university)", () => {
    const batch = templateAdapter("SCHOLAR", [
      { scholarId: "BT-CO-9", fullName: "X", country: "COLOMBIA", cohort: "2025", university: "U", academicProgram: "CS", gender: "Female" },
    ]);
    const res = validateBatch(batch, ctx());
    expect(res.errorRows).toBe(0);
    expect((res.validated.SCHOLAR ?? [])[0].operatorId).toBeUndefined();
  });

  it("does NOT reject a scholar for an unrecognized operator — keeps the scholar, operatorId unset", () => {
    // Operator is optional/secondary; an unknown label must never lose an otherwise-valid scholar
    // (mapping the wrong column once dropped ~224 rows). Never auto-creates an operator either.
    const batch = templateAdapter("SCHOLAR", [
      {
        scholarId: "BT-CO-9",
        fullName: "X",
        country: "COLOMBIA",
        cohort: "2025",
        university: "U",
        academicProgram: "CS",
        gender: "Female",
        operator: "Some Unknown Operator",
      },
    ]);
    const res = validateBatch(batch, ctx());
    expect(res.errors.some((e) => e.field === "operator")).toBe(false);
    expect(res.successRows).toBe(1);
    expect((res.validated.SCHOLAR ?? [])[0].operatorId).toBeUndefined();
  });

  it("treats 'Not applicable' / 'No aplica' as no operator (null, not an error)", () => {
    for (const value of ["Not applicable", "No aplica"]) {
      const batch = templateAdapter("SCHOLAR", [
        {
          scholarId: "BT-CO-9",
          fullName: "X",
          country: "COLOMBIA",
          cohort: "2025",
          university: "U",
          academicProgram: "CS",
          gender: "Female",
          operator: value,
        },
      ]);
      const res = validateBatch(batch, ctx());
      expect(res.errors.some((e) => e.field === "operator")).toBe(false);
      expect((res.validated.SCHOLAR ?? [])[0].operatorId).toBeUndefined();
    }
  });

  it("flags an invalid controlled value", () => {
    const batch = templateAdapter("SCHOLAR", [
      { scholarId: "BT-CO-9", fullName: "X", country: "BRAZIL", cohort: "2025", university: "U", academicProgram: "CS", gender: "Female" },
    ]);
    const res = validateBatch(batch, ctx());
    expect(res.errors.some((e) => e.field === "country")).toBe(true);
  });

  it("flags an out-of-range GPA", () => {
    const batch = templateAdapter("ACADEMIC_TERM", [{ scholarId: "BT-CO-001", term: "2025-1", gpa: "6" }]);
    const res = validateBatch(batch, ctx());
    expect(res.errors.some((e) => e.field === "gpa")).toBe(true);
  });

  it("flags an unknown scholarId on a dependent row", () => {
    const batch = templateAdapter("MONTHLY_CHECKIN", [{ scholarId: "BT-XX-999", reportingMonth: "2026-06" }]);
    const res = validateBatch(batch, ctx());
    expect(res.errors.some((e) => e.field === "scholarId")).toBe(true);
  });

  it("lets a scholar created earlier in the same batch satisfy dependents", () => {
    const batch: CanonicalBatch = {
      ...templateAdapter("SCHOLAR", [
        { scholarId: "BT-CO-777", fullName: "New", country: "PERU", cohort: "2026", university: "U", academicProgram: "CS", gender: "Male" },
      ]),
      ...templateAdapter("ACADEMIC_TERM", [{ scholarId: "BT-CO-777", term: "2026-1", gpa: "3.9" }]),
    };
    const res = validateBatch(batch, ctx());
    expect(res.errorRows).toBe(0);
    expect(res.validated.SCHOLAR).toHaveLength(1);
    expect(res.validated.ACADEMIC_TERM).toHaveLength(1);
  });

  it("synthesizes a deterministic submissionId for check-ins without one", () => {
    const batch = templateAdapter("MONTHLY_CHECKIN", [{ scholarId: "BT-CO-001", reportingMonth: "2026-06" }]);
    const res = validateBatch(batch, ctx());
    expect(res.validated.MONTHLY_CHECKIN[0].submissionId).toBe("import:checkin:BT-CO-001:2026-06");
  });

  it("requires scholarId on financial rows and commits only the valid rows", () => {
    const batch = templateAdapter("FINANCIAL_INPUT", [
      { scholarId: "BT-CO-001", period: "2026", costCategory: "Tuition", costAmount: "5000000", currency: "COP" },
      { period: "2026", costCategory: "Tuition", costAmount: "100", currency: "COP" }, // missing scholarId
    ]);
    const res = validateBatch(batch, ctx());
    expect(res.successRows).toBe(1);
    expect(res.errorRows).toBe(1);
    expect(res.errors.some((e) => e.field === "scholarId")).toBe(true);
  });
});
