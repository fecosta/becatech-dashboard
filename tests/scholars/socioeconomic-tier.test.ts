import { describe, expect, it } from "vitest";
import {
  parseSocioeconomicTier,
  TIER_MAPPING_APPROVED,
} from "@/lib/scholars/socioeconomic-tier";

describe("parseSocioeconomicTier", () => {
  it("maps the three harmonised source values", () => {
    expect(parseSocioeconomicTier("Vulnerabilidad alta")).toEqual({ tier: "TIER_1", status: "OK" });
    expect(parseSocioeconomicTier("Vulnerabilidad moderada")).toEqual({
      tier: "TIER_2",
      status: "OK",
    });
    expect(parseSocioeconomicTier("Vulnerabilidad baja")).toEqual({ tier: "TIER_3", status: "OK" });
  });

  // Roughly a fifth of scholars carry a literal "Pending". Giving them a tier would
  // overstate every row in the table.
  it("never assigns a tier to a pending or blank value", () => {
    for (const v of ["Pending", "", null, undefined]) {
      expect(parseSocioeconomicTier(v)).toEqual({ tier: null, status: "PENDING" });
    }
  });

  it("surfaces an unrecognized value instead of bucketing it", () => {
    expect(parseSocioeconomicTier("Estrato 3")).toEqual({ tier: null, status: "UNRECOGNIZED" });
  });

  it("keeps the tier wording switched off until the program approves it", () => {
    expect(TIER_MAPPING_APPROVED).toBe(false);
  });
});
