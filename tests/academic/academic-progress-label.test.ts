import { describe, expect, it } from "vitest";
import { parseScholarProgress } from "@/lib/academic/academic-progress-label";

describe("parseScholarProgress", () => {
  it("maps every value the source actually contains", () => {
    expect(parseScholarProgress("SATISFACTORIO")).toBe("ON_TRACK");
    expect(parseScholarProgress("REZAGADO(A)")).toBe("BEHIND");
    expect(parseScholarProgress("CRÍTICO")).toBe("CRITICAL");
    expect(parseScholarProgress("PENDIENTE DE INFO")).toBe("PENDING");
    expect(parseScholarProgress("Not applicable")).toBe("NOT_APPLICABLE");
  });

  it("is insensitive to accents, case and the (a) gender marker", () => {
    expect(parseScholarProgress("rezagado")).toBe("BEHIND");
    expect(parseScholarProgress("Critico")).toBe("CRITICAL");
  });

  it("treats a blank as pending and an unknown value as unknown, never as on track", () => {
    expect(parseScholarProgress("")).toBe("PENDING");
    expect(parseScholarProgress(null)).toBe("PENDING");
    expect(parseScholarProgress("EN NIVELACIÓN")).toBe("UNKNOWN");
  });
});
