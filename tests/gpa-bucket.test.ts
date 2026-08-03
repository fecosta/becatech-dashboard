import { describe, expect, it } from "vitest";
import { bucketGpa } from "@/lib/academic/gpa-bucket";

describe("bucketGpa", () => {
  it("buckets below 3.5", () => {
    expect(bucketGpa(2.5, "COLOMBIA")).toBe("BELOW_3_5");
    expect(bucketGpa(3.49, "COLOMBIA")).toBe("BELOW_3_5");
  });

  it("buckets 3.5 up to (not including) 4.0", () => {
    expect(bucketGpa(3.5, "COLOMBIA")).toBe("GPA_3_5_TO_3_9");
    expect(bucketGpa(3.9, "COLOMBIA")).toBe("GPA_3_5_TO_3_9");
  });

  it("buckets 4.0 and above", () => {
    expect(bucketGpa(4.0, "COLOMBIA")).toBe("GPA_4_0_TO_5_0");
    expect(bucketGpa(5.0, "COLOMBIA")).toBe("GPA_4_0_TO_5_0");
  });

  it("returns null for a missing GPA", () => {
    expect(bucketGpa(null, "COLOMBIA")).toBeNull();
    expect(bucketGpa(undefined, "COLOMBIA")).toBeNull();
  });

  it("returns null for Peru — these buckets are labeled with Colombia's absolute 0-5 scale", () => {
    // A Peru GPA of 17/20 (85%, a strong grade) would otherwise land in "GPA_4_0_TO_5_0" purely
    // because 17 > 4 in absolute terms, mislabeling it under a scale that isn't Peru's.
    expect(bucketGpa(17, "PERU")).toBeNull();
    expect(bucketGpa(2, "PERU")).toBeNull();
  });
});
