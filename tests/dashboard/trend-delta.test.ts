import { describe, expect, it } from "vitest";
import { computeDelta, deltaTone } from "@/lib/dashboard/trend-delta";

describe("computeDelta", () => {
  it("returns the percentage-point difference", () => {
    expect(computeDelta(73, 70)).toBe(3);
    expect(computeDelta(18, 20)).toBe(-2);
    expect(computeDelta(50, 50)).toBe(0);
  });

  it("returns null when either side has no data", () => {
    expect(computeDelta(null, 70)).toBeNull();
    expect(computeDelta(73, null)).toBeNull();
    expect(computeDelta(null, null)).toBeNull();
  });
});

describe("deltaTone", () => {
  it("participation (goodDirection: up) — increase is positive, decrease is negative", () => {
    expect(deltaTone(3, "up")).toBe("positive");
    expect(deltaTone(-2, "up")).toBe("negative");
  });

  it("risk (goodDirection: down) — decrease is positive, increase is negative", () => {
    expect(deltaTone(-2, "down")).toBe("positive");
    expect(deltaTone(1, "down")).toBe("negative");
  });

  it("no change or no data is neutral, regardless of direction", () => {
    expect(deltaTone(0, "up")).toBe("neutral");
    expect(deltaTone(0, "down")).toBe("neutral");
    expect(deltaTone(null, "up")).toBe("neutral");
    expect(deltaTone(null, "down")).toBe("neutral");
  });
});
