import { describe, expect, it } from "vitest";
import {
  allowedNextStages,
  canTransition,
  isTerminal,
  transition,
} from "@/lib/selection/stage-transitions";

describe("selection stage transitions", () => {
  it("allows a valid forward transition", () => {
    expect(canTransition("APPLICATION_RECEIVED", "ELIGIBILITY_REVIEW")).toBe(true);
    expect(canTransition("INTERVIEW", "FINAL_COMMITTEE")).toBe(true);
  });

  it("does not allow skipping stages", () => {
    expect(canTransition("APPLICATION_RECEIVED", "ASSESSMENT")).toBe(false);
  });

  it("allows rejection from a normal stage", () => {
    expect(canTransition("ASSESSMENT", "REJECTED")).toBe(true);
  });

  it("allows withdrawal from a normal stage", () => {
    expect(canTransition("INTERVIEW", "WITHDRAWN")).toBe(true);
  });

  it("prevents transitions after SELECTED", () => {
    expect(isTerminal("SELECTED")).toBe(true);
    expect(canTransition("SELECTED", "REJECTED")).toBe(false);
  });

  it("prevents transitions after REJECTED", () => {
    expect(canTransition("REJECTED", "APPLICATION_RECEIVED")).toBe(false);
  });

  it("prevents transitions after WITHDRAWN", () => {
    expect(canTransition("WITHDRAWN", "INTERVIEW")).toBe(false);
  });

  it("transition() throws on an invalid move and returns the target on a valid one", () => {
    expect(() => transition("SELECTED", "REJECTED")).toThrow();
    expect(transition("ASSESSMENT", "INTERVIEW")).toBe("INTERVIEW");
  });

  it("lists allowed next stages (forward + exits) and none when terminal", () => {
    expect(allowedNextStages("ASSESSMENT")).toEqual(["INTERVIEW", "REJECTED", "WITHDRAWN"]);
    expect(allowedNextStages("SELECTED")).toEqual([]);
  });
});
