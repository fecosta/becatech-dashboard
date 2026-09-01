import { describe, expect, it } from "vitest";
import {
  SCHOLAR_SECTION,
  scholarProfileHref,
  scholarSectionHref,
  withoutQuery,
} from "@/lib/dashboard/scholar-routes";

// The Scholar Profile section is three routes: two list screens and the individual
// profile they open in a new tab. These are the pure href builders both lists share, so a
// regression here means one list links somewhere the other does not.
describe("scholarProfileHref", () => {
  it("addresses a scholar by scholarId under the section route", () => {
    expect(scholarProfileHref("BT-CO-001")).toBe("/dashboard/scholars/BT-CO-001");
  });

  it("carries the dashboard filters so the new tab's top bar matches the list", () => {
    expect(scholarProfileHref("BT-CO-001", { country: "COLOMBIA", cohort: "2024-1" })).toBe(
      "/dashboard/scholars/BT-CO-001?country=COLOMBIA&cohort=2024-1",
    );
  });

  it("drops the search term — the profile is addressed by id, not by query", () => {
    expect(scholarProfileHref("BT-CO-001", { q: "Diego", country: "PERU" })).toBe(
      "/dashboard/scholars/BT-CO-001?country=PERU",
    );
  });

  it("encodes ids that would otherwise break the path", () => {
    expect(scholarProfileHref("a/b c")).toBe("/dashboard/scholars/a%2Fb%20c");
  });
});

describe("scholarSectionHref", () => {
  it("points at the two list screens", () => {
    expect(scholarSectionHref("contact")).toBe("/dashboard/scholars");
    expect(scholarSectionHref("find")).toBe("/dashboard/scholars/find");
  });

  it("preserves filters and drops q across a tab switch", () => {
    expect(scholarSectionHref("find", { q: "Diego", university: "UNAL" })).toBe(
      "/dashboard/scholars/find?university=UNAL",
    );
  });

  it("keeps the contact screen on the href the sidebar and SectionNav walk use", () => {
    expect(SCHOLAR_SECTION.contact.href).toBe("/dashboard/scholars");
  });
});

describe("withoutQuery", () => {
  it("removes only q", () => {
    expect(withoutQuery({ q: "x", country: "PERU", cohort: undefined })).toEqual({
      country: "PERU",
      cohort: undefined,
    });
  });
});
