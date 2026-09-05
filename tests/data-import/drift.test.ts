import { describe, expect, it } from "vitest";
import { classifyColumns } from "@/lib/data-import/validation/drift";
import type { SourceContract } from "@/lib/data-import/types";

const contract: SourceContract = {
  required: [["id"], ["nombre*"]],
  optional: [["cohorte", "cohort"], ["~situacion especifica"]],
  ignored: ["edad", "age"],
  repeating: [/^gpa \d{4}-\d$/],
};

describe("classifyColumns", () => {
  it("recognizes required and optional columns present in the header", () => {
    const report = classifyColumns(["id", "nombre completo", "cohorte"], contract);
    expect(report.recognized).toEqual(expect.arrayContaining(["id", "nombre completo", "cohorte"]));
    expect(report.missingRequired).toEqual([]);
  });

  it("reports a missing required column without failing the whole classification", () => {
    const report = classifyColumns(["nombre completo", "cohorte"], contract);
    expect(report.missingRequired).toEqual(["id"]);
  });

  it("does not warn on a known-ignored column", () => {
    const report = classifyColumns(["id", "nombre completo", "edad"], contract);
    expect(report.ignored).toEqual(["edad"]);
    expect(report.unknown).toEqual([]);
  });

  it("flags a genuinely new column as unknown, not an error", () => {
    const report = classifyColumns(["id", "nombre completo", "satisfaction score"], contract);
    expect(report.unknown).toEqual(["satisfaction score"]);
    expect(report.missingRequired).toEqual([]);
  });

  it("does not count a repeating-pattern column as unknown", () => {
    const report = classifyColumns(["id", "nombre completo", "gpa 2026-1"], contract);
    expect(report.unknown).toEqual([]);
  });

  it("matches a prefix alias against a merged header cell", () => {
    const report = classifyColumns(["id", "nombre completo (m o f)"], contract);
    expect(report.recognized).toContain("nombre completo (m o f)");
  });

  it("matches a contains alias against a free-text question", () => {
    const report = classifyColumns(["id", "nombre completo", "¿que situacion especifica esta presentando?"], contract);
    expect(report.recognized).toContain("¿que situacion especifica esta presentando?");
    expect(report.unknown).toEqual([]);
  });

  it("ignores blank header cells", () => {
    const report = classifyColumns(["id", "nombre completo", ""], contract);
    expect(report.unknown).toEqual([]);
    expect(report.ignored).toEqual([]);
  });
});
