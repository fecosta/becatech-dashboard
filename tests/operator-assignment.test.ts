import { describe, expect, it } from "vitest";
import { Country } from "@/generated/prisma/enums";
import { defaultOperatorName, OPERATOR_NAMES } from "@/lib/academic/operator-assignment";

describe("defaultOperatorName", () => {
  it("assigns the Colombia Early Support operator", () => {
    expect(defaultOperatorName(Country.COLOMBIA, "YEARS_1_2")).toBe(
      OPERATOR_NAMES.EARLY_SUPPORT_COLOMBIA,
    );
  });

  it("assigns the Peru Early Support operator", () => {
    expect(defaultOperatorName(Country.PERU, "YEARS_1_2")).toBe(OPERATOR_NAMES.EARLY_SUPPORT_PERU);
  });

  it("assigns MAKERS to Peru Growth & Development scholars", () => {
    expect(defaultOperatorName(Country.PERU, "YEARS_3_5")).toBe(OPERATOR_NAMES.GROWTH_MAKERS);
  });

  it("leaves Colombia Growth & Development ambiguous (caller must split)", () => {
    expect(defaultOperatorName(Country.COLOMBIA, "YEARS_3_5")).toBeNull();
  });

  it("returns null when the stage is unknown", () => {
    expect(defaultOperatorName(Country.COLOMBIA, null)).toBeNull();
  });
});
