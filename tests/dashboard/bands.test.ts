import { describe, expect, it } from "vitest";
import { atRiskBand, dropoutBand } from "@/lib/dashboard/bands";

// The bands are printed as a legend beside the bars, so the boundaries have to match
// what the legend claims exactly.
describe("dropoutBand", () => {
  it("splits at the legend's boundaries: 0–4 low, 5–7 medium, 8+ high", () => {
    expect(dropoutBand(0)).toBe("low");
    expect(dropoutBand(4)).toBe("low");
    expect(dropoutBand(5)).toBe("medium");
    expect(dropoutBand(7)).toBe("medium");
    expect(dropoutBand(8)).toBe("high");
    expect(dropoutBand(100)).toBe("high");
  });
});

describe("atRiskBand", () => {
  it("splits at the legend's boundaries: 0–27 low, 28–33 medium, 34+ high", () => {
    expect(atRiskBand(27)).toBe("low");
    expect(atRiskBand(28)).toBe("medium");
    expect(atRiskBand(33)).toBe("medium");
    expect(atRiskBand(34)).toBe("high");
  });
});
