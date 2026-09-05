import { describe, expect, it } from "vitest";
import { parseSemesterCell } from "@/lib/data-import/adapters/shared";

describe("parseSemesterCell", () => {
  it("parses ordinal Spanish semester words, confirmed from a real production sheet", () => {
    expect(parseSemesterCell("Sexto semestre")).toBe(6);
    expect(parseSemesterCell("Tercer semestre")).toBe(3);
    expect(parseSemesterCell("Primer semestre")).toBe(1);
    expect(parseSemesterCell("Segundo semestre")).toBe(2);
    expect(parseSemesterCell("Décimo semestre")).toBe(10);
  });

  it("passes through a plain number or a digit-prefixed value", () => {
    expect(parseSemesterCell(6)).toBe(6);
    expect(parseSemesterCell("3er semestre")).toBe(3);
    expect(parseSemesterCell("7")).toBe(7);
  });

  it("returns undefined (never NaN) for blank or unparseable input", () => {
    expect(parseSemesterCell(null)).toBeUndefined();
    expect(parseSemesterCell(undefined)).toBeUndefined();
    expect(parseSemesterCell("")).toBeUndefined();
    expect(parseSemesterCell("N/A")).toBeUndefined();
  });
});
