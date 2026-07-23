import { describe, expect, it } from "vitest";
import { bucketGpa } from "@/lib/academic/gpa-bucket";

describe("bucketGpa", () => {
  it("buckets below 3.5", () => {
    expect(bucketGpa(2.5)).toBe("BELOW_3_5");
    expect(bucketGpa(3.49)).toBe("BELOW_3_5");
  });

  it("buckets 3.5 up to (not including) 4.0", () => {
    expect(bucketGpa(3.5)).toBe("GPA_3_5_TO_3_9");
    expect(bucketGpa(3.9)).toBe("GPA_3_5_TO_3_9");
  });

  it("buckets 4.0 and above", () => {
    expect(bucketGpa(4.0)).toBe("GPA_4_0_TO_5_0");
    expect(bucketGpa(5.0)).toBe("GPA_4_0_TO_5_0");
  });

  it("returns null for a missing GPA", () => {
    expect(bucketGpa(null)).toBeNull();
    expect(bucketGpa(undefined)).toBeNull();
  });
});
