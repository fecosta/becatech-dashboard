import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// This repo has no jsdom/testing-library, so we can't observe an actual browser prefetch
// request firing (or not). What we CAN and should pin down at this level is that Sidebar
// itself passes prefetch={false} to next/link for every item — the exact regression this
// file guards against. Mocking next/link (rather than rendering the real one) also sidesteps
// its App Router context requirements, which renderToStaticMarkup alone can't satisfy.
const linkCalls: Array<{ href: string; prefetch?: boolean; "aria-current"?: string }> = [];
vi.mock("next/link", () => ({
  default: (props: { href: string; prefetch?: boolean; "aria-current"?: string; children?: unknown }) => {
    linkCalls.push({ href: props.href, prefetch: props.prefetch, "aria-current": props["aria-current"] });
    return createElement("a", { href: props.href }, props.children as never);
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/early-support" }));

import { Sidebar, type NavSection } from "@/components/Sidebar";

describe("Sidebar", () => {
  it("renders every nav link with prefetch disabled and correct active state", () => {
    const sections: NavSection[] = [
      {
        items: [
          { href: "/dashboard", label: "Home", exact: true },
          { href: "/dashboard/early-support", label: "Early Support" },
        ],
      },
    ];

    const html = renderToStaticMarkup(createElement(Sidebar, { sections }));

    expect(linkCalls).toHaveLength(2);
    for (const call of linkCalls) {
      expect(call.prefetch).toBe(false);
    }
    expect(linkCalls.find((c) => c.href === "/dashboard")?.["aria-current"]).toBeUndefined();
    expect(linkCalls.find((c) => c.href === "/dashboard/early-support")?.["aria-current"]).toBe("page");
    expect(html).toContain("Home");
    expect(html).toContain("Early Support");
  });
});
