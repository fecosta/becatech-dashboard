import { describe, expect, it } from "vitest";
import { templateAdapter } from "@/lib/data-import/adapters/template";
import type { CanonicalBatch, ValidationContext } from "@/lib/data-import/types";
import { validateBatch } from "@/lib/data-import/validate";

function ctx(): ValidationContext {
  return {
    existingScholarIds: new Set(["BT-CO-001"]),
    controls: new Map<string, Set<string>>([
      ["country", new Set(["COLOMBIA", "PERU"])],
      ["program_status", new Set(["ACTIVE", "WITHDRAWN", "GRADUATED", "PAUSED"])],
      ["activity_type", new Set(["INDIVIDUAL_TUTORING", "GROUP_TUTORING", "WORKSHOP", "OTHER"])],
      ["request_status", new Set(["SUBMITTED", "IN_REVIEW", "RESOLVED", "REJECTED", "PENDING"])],
      ["cost_category", new Set(["Tuition", "Scholarship amount"])],
      ["academic_progress_status", new Set(["ON_TRACK", "SLIGHTLY_BEHIND", "BEHIND", "CRITICAL_DELAY"])],
    ]),
  };
}

describe("import validation", () => {
  it("accepts a valid academic term for an existing scholar", () => {
    const batch = templateAdapter("ACADEMIC_TERM", [{ scholarId: "BT-CO-001", term: "2025-1", gpa: "4.1" }]);
    const res = validateBatch(batch, ctx());
    expect(res.errorRows).toBe(0);
    expect(res.validated.ACADEMIC_TERM).toHaveLength(1);
  });

  it("flags a missing required field", () => {
    const batch = templateAdapter("ACADEMIC_TERM", [{ scholarId: "BT-CO-001" }]); // no term
    const res = validateBatch(batch, ctx());
    expect(res.errors.some((e) => e.field === "term")).toBe(true);
    expect(res.successRows).toBe(0);
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
