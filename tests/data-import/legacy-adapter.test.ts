import { describe, expect, it } from "vitest";
import { isGeneralInfoSheet, legacyAdapter } from "@/lib/data-import/adapters/legacy";
import type { ParsedSheet } from "@/lib/data-import/parse";
import type { CanonicalRow, ValidationContext } from "@/lib/data-import/types";
import { validateBatch } from "@/lib/data-import/validate";

function generalInfoSheet(extra: Record<string, unknown> = {}): ParsedSheet[] {
  return [
    {
      sheetName: "SCHOLAR GENERAL INFO",
      records: [
        {
          ID: "BT-CO-001",
          PAÍS: "Colombia",
          COHORTE: "2025",
          UNIVERSIDAD: "Universidad Nacional de Colombia",
          "PROGRAMA ACADÉMICO": "Computer Science",
          "NOMBRE COMPLETO": "Ana Pérez Gómez",
          GÉNERO: "Female",
          "ESTADO ACTUAL": "Activo",
          "GPA 2024-1": "4.1",
          "GPA 2024-2": "3.8",
          "CRÉDITOS 2024-1": "16",
          "ESTADO MATRÍCULA 2024-1": "Matriculado",
          "MATERIAS REPROBADAS/ CANCELADAS 2024-1": "1",
          ...extra,
        },
      ],
    },
  ];
}

const termRow = (rows: CanonicalRow[] | undefined, term: string) =>
  (rows ?? []).find((r) => r.data.term === term);

describe("legacy wide-Excel adapter", () => {
  it("detects a general-info sheet", () => {
    expect(isGeneralInfoSheet(generalInfoSheet()[0].records)).toBe(true);
    expect(isGeneralInfoSheet([{ foo: "bar" }])).toBe(false);
  });

  it("maps identity columns and normalizes country/status", () => {
    const batch = legacyAdapter(generalInfoSheet());
    const scholar = (batch.SCHOLAR ?? [])[0];
    expect(scholar.data.scholarId).toBe("BT-CO-001");
    expect(scholar.data.country).toBe("COLOMBIA");
    expect(scholar.data.programStatus).toBe("ACTIVE");
    expect(scholar.data.fullName).toBe("Ana Pérez Gómez");
  });

  it("pivots repeating per-term columns into academic-term rows", () => {
    const batch = legacyAdapter(generalInfoSheet());
    expect(batch.ACADEMIC_TERM).toHaveLength(2);
    const t1 = termRow(batch.ACADEMIC_TERM, "2024-1");
    expect(t1?.data.gpa).toBe(4.1);
    expect(t1?.data.creditsEnrolled).toBe(16);
    expect(t1?.data.enrollmentStatus).toBe("Matriculado");
    expect(t1?.data.failedSubjectsCount).toBe(1);
    expect(termRow(batch.ACADEMIC_TERM, "2024-2")?.data.gpa).toBe(3.8);
  });

  it("auto-detects a new term column via regex (no code change)", () => {
    const batch = legacyAdapter(generalInfoSheet({ "GPA 2026-1": "3.5" }));
    expect(termRow(batch.ACADEMIC_TERM, "2026-1")?.data.gpa).toBe(3.5);
  });

  it("produces rows that pass validation (wide -> long -> valid)", () => {
    const ctx: ValidationContext = {
      existingScholarIds: new Set(),
      controls: new Map<string, Set<string>>([
        ["country", new Set(["COLOMBIA", "PERU"])],
        ["program_status", new Set(["ACTIVE", "WITHDRAWN", "GRADUATED", "PAUSED"])],
      ]),
      universities: new Map([["universidad nacional de colombia", "uni-unal"]]),
    };
    const res = validateBatch(legacyAdapter(generalInfoSheet()), ctx);
    expect(res.errorRows).toBe(0);
    expect(res.validated.SCHOLAR).toHaveLength(1);
    expect(res.validated.ACADEMIC_TERM).toHaveLength(2);
  });
});
