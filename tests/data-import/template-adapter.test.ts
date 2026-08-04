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

  it("maps the new Scholar profile fields, coercing a bare graduation year to int (not a Date)", () => {
    const batch = templateAdapter("SCHOLAR", [
      {
        scholarId: "BT-CO-001",
        fullName: "Ana",
        country: "COLOMBIA",
        cohort: "2025",
        university: "U",
        academicProgram: "CS",
        gender: "Female",
        estimatedGraduationYear: "2027",
        programDurationYears: "5",
        highSchoolGraduationYear: "2020",
        motherEducationLevel: "Secundaria",
        fatherEducationLevel: "Técnico",
        email1: "ana@example.com",
        email2: "ana.alt@example.com",
        dateOfBirth: "2002-05-10",
        mobilePhone: "+57 300 000 0000",
        socioeconomicLevel: "2",
      },
    ]);
    const row = (batch.SCHOLAR ?? [])[0];
    expect(row.data.estimatedGraduationYear).toBe(2027);
    expect(typeof row.data.estimatedGraduationYear).toBe("number");
    expect(row.data.estimatedGraduationYear).not.toBeInstanceOf(Date);
    expect(row.data.programDurationYears).toBe(5);
    expect(row.data.dateOfBirth).toBeInstanceOf(Date);
    expect(row.data.email1).toBe("ana@example.com");
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

  it("maps the new mentor-report fields (semester, mentorReportedGlobalStatus)", () => {
    const batch = templateAdapter("MENTOR_REPORT", [
      {
        scholarId: "BT-CO-001",
        semester: "5",
        mentorReportedGlobalStatus: "Estable",
      },
    ]);
    const row = (batch.MENTOR_REPORT ?? [])[0];
    expect(row.data.semester).toBe("5");
    expect(row.data.mentorReportedGlobalStatus).toBe("Estable");
  });

  it("maps the manual-template-only leveling/deadline fields (no header-migration ambiguity here — the analyst supplies them per term deliberately)", () => {
    const batch = templateAdapter("ACADEMIC_TERM", [
      {
        scholarId: "BT-CO-001",
        term: "2025-1",
        delayedSubjects: "Cálculo II",
        levelingAlternative: "Curso de verano",
        maxDeadline: "2025-12-01",
      },
    ]);
    const row = (batch.ACADEMIC_TERM ?? [])[0];
    expect(row.data.delayedSubjects).toBe("Cálculo II");
    expect(row.data.levelingAlternative).toBe("Curso de verano");
    expect(row.data.maxDeadline).toBeInstanceOf(Date);
  });
});
