import { describe, expect, it } from "vitest";
import { templateAdapter } from "@/lib/data-import/adapters/template";

describe("template adapter", () => {
  it("maps headers to fields and coerces types", () => {
    const batch = templateAdapter("SCHOLAR", [
      {
        scholarId: "BT-CO-001",
        fullName: "Ana",
        country: "COLOMBIA",
        cohort: "2025",
        university: "U",
        academicProgram: "CS",
        gender: "Female",
        currentSemester: "3",
        startDate: "2025-02-01",
      },
    ]);
    const rows = batch.SCHOLAR ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].rowNumber).toBe(2); // row 1 is the header
    expect(rows[0].data.scholarId).toBe("BT-CO-001");
    expect(rows[0].data.currentSemester).toBe(3);
    expect(rows[0].data.startDate).toBeInstanceOf(Date);
  });

  it("accepts the ID_becario alias and coerces floats", () => {
    const batch = templateAdapter("ACADEMIC_TERM", [{ ID_becario: "BT-CO-001", term: "2025-1", gpa: "4.2" }]);
    const row = (batch.ACADEMIC_TERM ?? [])[0];
    expect(row.data.scholarId).toBe("BT-CO-001");
    expect(row.data.gpa).toBe(4.2);
  });

  it("coerces booleans and ignores unknown headers", () => {
    const batch = templateAdapter("ACADEMIC_TERM", [
      { scholarId: "x", term: "2025-1", isLeveling: "yes", bogusColumn: "z" },
    ]);
    const row = (batch.ACADEMIC_TERM ?? [])[0];
    expect(row.data.isLeveling).toBe(true);
    expect(row.data.bogusColumn).toBeUndefined();
  });
});
