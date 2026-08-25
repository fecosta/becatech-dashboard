import { describe, expect, it } from "vitest";
import { parseEnglishLevel } from "@/lib/academic/english-level";

describe("parseEnglishLevel", () => {
  it("reads the six CEFR levels", () => {
    for (const level of ["A1", "A2", "B1", "B2", "C1", "C2"] as const) {
      expect(parseEnglishLevel(level)).toEqual({ status: "OK", level });
    }
  });

  it("accepts a sub-level suffix, where the level is still unambiguous", () => {
    expect(parseEnglishLevel("B1.2")).toEqual({ status: "OK", level: "B1" });
    expect(parseEnglishLevel("b2-1")).toEqual({ status: "OK", level: "B2" });
  });

  it("separates not-yet-reported from not-applicable", () => {
    expect(parseEnglishLevel("Pending").status).toBe("PENDING");
    expect(parseEnglishLevel("").status).toBe("PENDING");
    expect(parseEnglishLevel(null).status).toBe("PENDING");
    expect(parseEnglishLevel("Not applicable").status).toBe("NOT_APPLICABLE");
  });

  // The source contains a "B!" typo. A startsWith scan would drop it silently and make
  // the denominator quietly wrong; it has to surface instead.
  it("surfaces unreadable values rather than dropping them", () => {
    expect(parseEnglishLevel("B!")).toEqual({ status: "UNRECOGNIZED", level: null });
    expect(parseEnglishLevel("#N/A").status).toBe("UNRECOGNIZED");
    expect(parseEnglishLevel("0").status).toBe("UNRECOGNIZED");
    expect(parseEnglishLevel("Nivel 4").status).toBe("UNRECOGNIZED");
  });
});
