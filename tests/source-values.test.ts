import { describe, expect, it } from "vitest";
import {
  displaySourceValue,
  normalizeSourceValue,
  translateSourceValue,
} from "@/lib/display/source-values";

describe("source-value translation (controlled Spanish → English)", () => {
  it("translates known enrollment values, tolerating gender markers and case", () => {
    expect(translateSourceValue("enrollmentStatus", "MATRICULADO(A)")).toEqual({
      value: "Enrolled",
      known: true,
    });
    expect(translateSourceValue("enrollmentStatus", "matriculado")).toEqual({
      value: "Enrolled",
      known: true,
    });
    expect(translateSourceValue("enrollmentStatus", "NO MATRICULADO(A)")).toEqual({
      value: "Not enrolled",
      known: true,
    });
  });

  it("tolerates accents, extra whitespace, and trailing punctuation", () => {
    expect(normalizeSourceValue("  Én Riésgo :")).toBe("en riesgo");
    expect(translateSourceValue("checkinStatus", "  En  Riesgo ")).toEqual({
      value: "At risk",
      known: true,
    });
    expect(translateSourceValue("modality", "Presencial")).toEqual({ value: "In person", known: true });
    expect(translateSourceValue("riskWord", "ALTO")).toEqual({ value: "High", known: true });
  });

  it("maps aliases to the same English value", () => {
    expect(translateSourceValue("modality", "Híbrido").value).toBe("Hybrid");
    expect(translateSourceValue("modality", "Mixto").value).toBe("Hybrid");
  });

  it("returns an unknown value verbatim with known:false — never a guessed translation", () => {
    expect(translateSourceValue("enrollmentStatus", "Algo Raro")).toEqual({
      value: "Algo Raro",
      known: false,
    });
  });

  it("treats null/blank as nothing-to-translate (known:true, empty), not an unknown value", () => {
    expect(translateSourceValue("modality", null)).toEqual({ value: "", known: true });
    expect(translateSourceValue("modality", "   ")).toEqual({ value: "", known: true });
  });

  it("displaySourceValue renders English, raw-for-unknown, or an em dash for empty", () => {
    expect(displaySourceValue("enrollmentStatus", "MATRICULADO(A)")).toBe("Enrolled");
    expect(displaySourceValue("enrollmentStatus", "Algo Raro")).toBe("Algo Raro");
    expect(displaySourceValue("enrollmentStatus", null)).toBe("—");
  });
});
