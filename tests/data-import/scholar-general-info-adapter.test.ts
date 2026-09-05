// Tests the formalized SourceAdapter (adapters/scholar-general-info.ts) against a realistic,
// synthetic fixture modeled on the live sheet's shape: a decorative title row, a category row,
// then the real field-name header — with GPA columns placed *before* the identity columns (not
// the "natural" reading order) to prove column position isn't relied on. All scholar/mentor names
// and IDs are fictional.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scholarGeneralInfoAdapter } from "@/lib/data-import/adapters/scholar-general-info";
import type { ParsedSheet } from "@/lib/data-import/parse";
import { parseWorkbook } from "@/lib/data-import/parse";
import type { ValidationContext } from "@/lib/data-import/types";
import { validateBatch } from "@/lib/data-import/validate";

function loadFixtureSheet(): ParsedSheet {
  const buf = readFileSync(path.join(__dirname, "../fixtures/scholar-general-info.csv"));
  return parseWorkbook(buf)[0];
}

describe("scholarGeneralInfoAdapter (fixture)", () => {
  it("detects the sheet past the decorative title/category rows above the real header", () => {
    expect(scholarGeneralInfoAdapter.canHandle(loadFixtureSheet())).toBe(true);
  });

  it("adapts every scholar and only the terms that actually have data (no fabricated future term)", () => {
    const batch = scholarGeneralInfoAdapter.adapt(loadFixtureSheet());
    expect(batch.SCHOLAR).toHaveLength(4);
    expect((batch.SCHOLAR ?? []).map((r) => r.data.scholarId)).toEqual([
      "BT-CO-101",
      "BT-CO-102",
      "BT-PE-201",
      "BT-PE-202",
    ]);

    const termsFor = (id: string) => (batch.ACADEMIC_TERM ?? []).filter((r) => r.data.scholarId === id);
    // GPA 2026-1 is blank for BT-CO-101 (a future/not-yet-reported term): the column itself is
    // still tracked (a term row exists, since the header column is present for every scholar),
    // but no GPA value is fabricated for it — it stays null, not a guessed number.
    const bt101Terms = termsFor("BT-CO-101");
    expect(bt101Terms.find((r) => r.data.term === "2025-2")?.data.gpa).toBe(4.2);
    expect(bt101Terms.find((r) => r.data.term === "2026-1")?.data.gpa).toBeNull();
    // BT-PE-201 has both terms reported — a multi-term scholar.
    const bt201Terms = termsFor("BT-PE-201");
    expect(bt201Terms.find((r) => r.data.term === "2025-2")?.data.gpa).toBe(15.5);
    expect(bt201Terms.find((r) => r.data.term === "2026-1")?.data.gpa).toBe(17.0);
  });

  it("parses a comma-decimal GPA the same as a period-decimal one (real production shape)", () => {
    // Confirmed from production: GPA 2025-2/2026-1 use "4,28"/"4,7" while GPA 2024-1/2024-2/2025-1
    // in the same row use "3.94"/"4.34" — Number() alone would silently drop the comma ones to null.
    const sheet: ParsedSheet = {
      sheetName: "SCHOLAR GENERAL INFO",
      records: [
        {
          ID: "BT-CO-990",
          PAÍS: "Colombia",
          COHORTE: "2025",
          UNIVERSIDAD: "Universidad Nacional de Colombia",
          "PROGRAMA ACADÉMICO": "Computer Science",
          "NOMBRE COMPLETO": "Comma Gpa Fictional Scholar",
          GÉNERO: "Female",
          "GPA 2024-1": "3.94",
          "GPA 2025-2": "4,28",
          "Cumulative GPA": "4,0",
        },
      ],
    };
    const batch = scholarGeneralInfoAdapter.adapt(sheet);
    const terms = (batch.ACADEMIC_TERM ?? []).filter((r) => r.data.scholarId === "BT-CO-990");
    expect(terms.find((r) => r.data.term === "2024-1")?.data.gpa).toBe(3.94);
    expect(terms.find((r) => r.data.term === "2025-2")?.data.gpa).toBe(4.28);
    expect(terms.find((r) => r.data.term === "2025-2")?.data.accumulatedGpa).toBe(4.0);
  });

  it("parses an ordinal Spanish semester word into a number (real production shape)", () => {
    const sheet: ParsedSheet = {
      sheetName: "SCHOLAR GENERAL INFO",
      records: [
        {
          ID: "BT-CO-970",
          PAÍS: "Colombia",
          COHORTE: "2025",
          UNIVERSIDAD: "Universidad Nacional de Colombia",
          "PROGRAMA ACADÉMICO": "Computer Science",
          "NOMBRE COMPLETO": "Semester Word Fictional Scholar",
          GÉNERO: "Female",
          "CURRENT SEMESTER": "Sexto semestre",
          "GPA 2026-1": "4.0",
        },
      ],
    };
    const batch = scholarGeneralInfoAdapter.adapt(sheet);
    expect(batch.SCHOLAR?.[0].data.currentSemester).toBe(6);
  });

  it("attaches Cumulative GPA and an Overdue-Courses-derived status to the latest REPORTED term, not a blank future one", () => {
    const sheet: ParsedSheet = {
      sheetName: "SCHOLAR GENERAL INFO",
      records: [
        {
          ID: "BT-CO-980",
          PAÍS: "Colombia",
          COHORTE: "2025",
          UNIVERSIDAD: "Universidad Nacional de Colombia",
          "PROGRAMA ACADÉMICO": "Computer Science",
          "NOMBRE COMPLETO": "Cumulative Fictional Scholar",
          GÉNERO: "Female",
          "GPA 2025-2": "4.0",
          "GPA 2026-1": "", // future/not-yet-reported term — stays blank, never guessed onto
          "Cumulative GPA": "3.8",
          "Overdue Courses": "1",
        },
      ],
    };
    const batch = scholarGeneralInfoAdapter.adapt(sheet);
    const terms = (batch.ACADEMIC_TERM ?? []).filter((r) => r.data.scholarId === "BT-CO-980");
    const t20252 = terms.find((r) => r.data.term === "2025-2");
    const t20261 = terms.find((r) => r.data.term === "2026-1");
    expect(t20252?.data.accumulatedGpa).toBe(3.8);
    expect(t20252?.data.expectedProgressStatus).toBe("BEHIND");
    expect(t20261?.data.accumulatedGpa).toBeUndefined();
    expect(t20261?.data.expectedProgressStatus).toBeUndefined();
  });

  it("maps Overdue Courses to the program's on-track/behind/critical definitions", () => {
    const scholar = (id: string, overdueCourses: string) => ({
      ID: id,
      PAÍS: "Colombia",
      COHORTE: "2025",
      UNIVERSIDAD: "Universidad Nacional de Colombia",
      "PROGRAMA ACADÉMICO": "Computer Science",
      "NOMBRE COMPLETO": `Overdue Fictional Scholar ${id}`,
      GÉNERO: "Female",
      "GPA 2026-1": "4.0",
      "Overdue Courses": overdueCourses,
    });
    const sheet: ParsedSheet = {
      sheetName: "SCHOLAR GENERAL INFO",
      records: [scholar("BT-CO-991", "0"), scholar("BT-CO-992", "1"), scholar("BT-CO-993", "3")],
    };
    const batch = scholarGeneralInfoAdapter.adapt(sheet);
    const statusFor = (id: string) =>
      (batch.ACADEMIC_TERM ?? []).find((r) => r.data.scholarId === id)?.data.expectedProgressStatus;
    expect(statusFor("BT-CO-991")).toBe("ON_TRACK");
    expect(statusFor("BT-CO-992")).toBe("BEHIND");
    expect(statusFor("BT-CO-993")).toBe("CRITICAL_DELAY");
  });

  it("does not attach Cumulative GPA to any term when the scholar has no reported term data", () => {
    const sheet: ParsedSheet = {
      sheetName: "SCHOLAR GENERAL INFO",
      records: [
        {
          ID: "BT-CO-981",
          PAÍS: "Colombia",
          COHORTE: "2025",
          UNIVERSIDAD: "Universidad Nacional de Colombia",
          "PROGRAMA ACADÉMICO": "Computer Science",
          "NOMBRE COMPLETO": "No Term Data Fictional Scholar",
          GÉNERO: "Female",
          "GPA 2026-1": "", // the only tracked term column, blank — nothing reported yet
          "Cumulative GPA": "3.5",
        },
      ],
    };
    const batch = scholarGeneralInfoAdapter.adapt(sheet);
    const terms = (batch.ACADEMIC_TERM ?? []).filter((r) => r.data.scholarId === "BT-CO-981");
    expect(terms.every((r) => r.data.accumulatedGpa == null)).toBe(true);
  });

  it("preserves the withdrawn scholar's status rather than defaulting it to active", () => {
    const batch = scholarGeneralInfoAdapter.adapt(loadFixtureSheet());
    const withdrawn = (batch.SCHOLAR ?? []).find((r) => r.data.scholarId === "BT-CO-102");
    expect(withdrawn?.data.programStatus).toBe("WITHDRAWN");
  });

  it("keeps Colombia and Peru GPA values on their own native scale, unconverted", () => {
    const batch = scholarGeneralInfoAdapter.adapt(loadFixtureSheet());
    const peruTerm = (batch.ACADEMIC_TERM ?? []).find(
      (r) => r.data.scholarId === "BT-PE-201" && r.data.term === "2025-2",
    );
    // 15.5 is only valid on Peru's 0-20 scale — would be rejected as out-of-range on Colombia's 0-5.
    expect(peruTerm?.data.gpa).toBe(15.5);
  });

  it("classifies the header: an unrelated new column warns, a known-ignored column doesn't, all required columns are recognized", () => {
    const report = scholarGeneralInfoAdapter.inspectSchema!(loadFixtureSheet());
    expect(report.unknown).toContain("satisfaction score");
    expect(report.ignored).toContain("edad");
    expect(report.unknown).not.toContain("edad");
    expect(report.missingRequired).toEqual([]);
  });

  it("maps the extended profile fields present on the real sheet (email, DOB, phone, origin, English level)", () => {
    const sheet: ParsedSheet = {
      sheetName: "SCHOLAR GENERAL INFO",
      records: [
        {
          ID: "BT-CO-960",
          COUNTRY: "Colombia",
          COHORT: "2025",
          UNIVERSITY: "Universidad Nacional de Colombia",
          "ACADEMIC PROGRAM": "Computer Science",
          "SCHOLARS NAME": "Extended Fictional Scholar",
          GENDER: "Female",
          "EMAIL 1": "extended.fictional@example.test",
          "EMAIL 2": "extended.fictional.alt@example.test",
          "Mobile Phone": "3001234567",
          "Date of Birth": "2003-04-12",
          "Ethnic Group": "Mestizo",
          "Socioeconomic Level": "Vulnerabilidad moderada",
          "Department of Origin": "Antioquia",
          "Municipality of Origin": "Medellín",
          "Current Department of Residence": "Antioquia",
          "Current Municipality of Residence": "Medellín",
          "Mother's Education Level": "Secundaria",
          "Father's Education Level": "Primaria",
          "Program Duration (Years)": "5",
          "Estimated Graduation Year": "2029",
          "High School Graduation Year": "2024",
          "Academic Progress": "On track",
          "English level - 2026-1": "B1",
          "GPA 2026-1": "4.0",
        },
      ],
    };
    const batch = scholarGeneralInfoAdapter.adapt(sheet);
    const scholar = batch.SCHOLAR?.[0].data;
    expect(scholar?.email1).toBe("extended.fictional@example.test");
    expect(scholar?.email2).toBe("extended.fictional.alt@example.test");
    expect(scholar?.mobilePhone).toBe("3001234567");
    expect(scholar?.dateOfBirth).toBeInstanceOf(Date);
    expect(scholar?.ethnicGroup).toBe("Mestizo");
    expect(scholar?.socioeconomicLevel).toBe("Vulnerabilidad moderada");
    expect(scholar?.departmentOrigin).toBe("Antioquia");
    expect(scholar?.municipalityOrigin).toBe("Medellín");
    expect(scholar?.currentDepartment).toBe("Antioquia");
    expect(scholar?.currentMunicipality).toBe("Medellín");
    expect(scholar?.motherEducationLevel).toBe("Secundaria");
    expect(scholar?.fatherEducationLevel).toBe("Primaria");
    expect(scholar?.programDurationYears).toBe(5);
    expect(scholar?.estimatedGraduationYear).toBe(2029);
    expect(scholar?.highSchoolGraduationYear).toBe(2024);
    expect(scholar?.academicProgress).toBe("On track");
    expect(scholar?.currentEnglishLevel).toBe("B1");

    const report = scholarGeneralInfoAdapter.inspectSchema!(sheet);
    expect(report.unknown).toEqual([]);
    expect(report.missingRequired).toEqual([]);
  });

  it("tolerates a fully reordered, mixed-language header (identity columns after the term column)", () => {
    const sheet: ParsedSheet = {
      sheetName: "SCHOLAR GENERAL INFO",
      records: [
        {
          "GPA 2026-1": "3.9",
          GÉNERO: "Male",
          "PROGRAMA ACADÉMICO": "Physics",
          UNIVERSIDAD: "Universidad Nacional de Colombia",
          COHORTE: "2025",
          PAÍS: "Colombia",
          ID: "BT-CO-900",
          "NOMBRE COMPLETO": "Reordered Fictional Scholar",
          "ESTADO ACTUAL": "Activo",
        },
      ],
    };
    expect(scholarGeneralInfoAdapter.canHandle(sheet)).toBe(true);
    const batch = scholarGeneralInfoAdapter.adapt(sheet);
    expect(batch.SCHOLAR?.[0].data.scholarId).toBe("BT-CO-900");
    expect(batch.ACADEMIC_TERM?.[0].data.gpa).toBe(3.9);
  });

  it("produces rows that pass validation end to end, including missing-optional-column tolerance", () => {
    // The fixture has no operator/current-semester/start-date/expected-end-date columns at all —
    // all optional — and still validates cleanly.
    const ctx: ValidationContext = {
      existingScholarIds: new Set(),
      scholarIdsByNormalizedName: new Map(),
      countryByScholarId: new Map(),
      controls: new Map<string, Set<string>>([
        ["country", new Set(["COLOMBIA", "PERU"])],
        ["program_status", new Set(["ACTIVE", "WITHDRAWN", "GRADUATED", "PAUSED"])],
      ]),
      universities: new Map([
        ["universidad nacional de colombia", "uni-unal"],
        ["universidad de antioquia", "uni-udea"],
        ["universidad nacional mayor de san marcos", "uni-unmsm"],
      ]),
      operatorsByName: new Map(),
    };
    const result = validateBatch(scholarGeneralInfoAdapter.adapt(loadFixtureSheet()), ctx);
    expect(result.errorRows).toBe(0);
    expect(result.validated.SCHOLAR).toHaveLength(4);
    // Every scholar has a row for both tracked terms (2025-2, 2026-1) — a blank GPA cell validates
    // fine (no fabricated/guessed value, no range-check error) since it stays null, not a number.
    expect(result.validated.ACADEMIC_TERM).toHaveLength(8);
  });
});
