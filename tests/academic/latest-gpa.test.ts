import { describe, expect, it } from "vitest";
import type { Country } from "@/generated/prisma/enums";
import { isGradedGpa, selectLatestGradedGpa, type GpaTermRow } from "@/lib/academic/latest-gpa";

const CO = new Map<string, Country>([["S-CO", "COLOMBIA"]]);
const PE = new Map<string, Country>([["S-PE", "PERU"]]);

const term = (scholarId: string, t: string, gpa: number | null): GpaTermRow => ({
  scholarId,
  term: t,
  gpa,
});

describe("isGradedGpa", () => {
  it("accepts a real grade inside the country's native scale", () => {
    expect(isGradedGpa(3.5, "COLOMBIA")).toBe(true);
    expect(isGradedGpa(5, "COLOMBIA")).toBe(true);
    expect(isGradedGpa(17.5, "PERU")).toBe(true);
    expect(isGradedGpa(20, "PERU")).toBe(true);
  });

  it("rejects 0 — the source writes it for terms nobody was enrolled in, not a failing grade", () => {
    expect(isGradedGpa(0, "COLOMBIA")).toBe(false);
    expect(isGradedGpa(0, "PERU")).toBe(false);
  });

  it("rejects null, non-finite, negative, and above-scale values", () => {
    expect(isGradedGpa(null, "COLOMBIA")).toBe(false);
    expect(isGradedGpa(undefined, "COLOMBIA")).toBe(false);
    expect(isGradedGpa(NaN, "COLOMBIA")).toBe(false);
    expect(isGradedGpa(Infinity, "COLOMBIA")).toBe(false);
    expect(isGradedGpa(-1, "COLOMBIA")).toBe(false);
    expect(isGradedGpa(5.1, "COLOMBIA")).toBe(false);
    // 17.5 is a fine Peru grade but off Colombia's 0–5 scale entirely.
    expect(isGradedGpa(17.5, "COLOMBIA")).toBe(false);
    expect(isGradedGpa(20.5, "PERU")).toBe(false);
  });
});

describe("selectLatestGradedGpa", () => {
  it("picks the latest graded term", () => {
    const { byScholar } = selectLatestGradedGpa(
      [term("S-CO", "2024-2", 3.2), term("S-CO", "2025-1", 4.1)],
      CO,
    );
    expect(byScholar.get("S-CO")).toBe(4.1);
  });

  it("does not let a later ungraded term mask the latest real grade", () => {
    // The production shape: the sheet forward-fills future terms as 0 or blank.
    const { byScholar } = selectLatestGradedGpa(
      [term("S-CO", "2024-2", 3.2), term("S-CO", "2025-1", 4.1), term("S-CO", "2025-2", 0), term("S-CO", "2026-1", null)],
      CO,
    );
    expect(byScholar.get("S-CO")).toBe(4.1);
  });

  it("counts the zero-GPA rows it skipped", () => {
    const { excludedZeroGpaCount } = selectLatestGradedGpa(
      [term("S-CO", "2025-1", 4.1), term("S-CO", "2025-2", 0), term("S-CO", "2026-1", 0)],
      CO,
    );
    expect(excludedZeroGpaCount).toBe(2);
  });

  it("is independent of the order rows arrive in", () => {
    const rows = [term("S-CO", "2025-2", 2.9), term("S-CO", "2024-1", 4.8), term("S-CO", "2025-1", 3.3)];
    expect(selectLatestGradedGpa(rows, CO).byScholar.get("S-CO")).toBe(2.9);
    expect(selectLatestGradedGpa([...rows].reverse(), CO).byScholar.get("S-CO")).toBe(2.9);
  });

  it("omits a scholar whose only terms are invalid", () => {
    const { byScholar } = selectLatestGradedGpa(
      [term("S-CO", "2025-1", 0), term("S-CO", "2025-2", null), term("S-CO", "2026-1", -2)],
      CO,
    );
    expect(byScholar.has("S-CO")).toBe(false);
  });

  it("applies each scholar's own country scale", () => {
    const countries = new Map<string, Country>([...CO, ...PE]);
    const { byScholar } = selectLatestGradedGpa(
      // 17.5 is valid for Peru and out of scale for Colombia.
      [term("S-CO", "2025-1", 17.5), term("S-PE", "2025-1", 17.5)],
      countries,
    );
    expect(byScholar.has("S-CO")).toBe(false);
    expect(byScholar.get("S-PE")).toBe(17.5);
  });

  it("ignores terms for scholars outside the given scope", () => {
    const { byScholar } = selectLatestGradedGpa([term("S-OTHER", "2025-1", 4.0)], CO);
    expect(byScholar.size).toBe(0);
  });
});
