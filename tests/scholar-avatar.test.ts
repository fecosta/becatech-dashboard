// No React-rendering test infrastructure exists in this repo yet (no jsdom/happy-dom, no
// @testing-library/react — vitest.config.ts runs environment: "node" and only includes
// tests/**/*.test.ts). renderToStaticMarkup needs no DOM, so it renders ScholarAvatar
// under the existing "node" environment with zero new dependencies and no
// vitest.config.ts change — this file stays .ts and builds elements with
// React.createElement instead of JSX. ScholarAvatar's "use client" directive is inert
// outside Next's bundler; imported directly here it behaves as an ordinary function
// component.
//
// This can only assert on a single render pass's static HTML, so it covers the "src is
// null" fallback case and the happy path. It cannot simulate a browser actually firing
// the <img>'s onError (that needs a real DOM) — that gap is covered by manual browser QA
// instead of new test tooling.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScholarAvatar } from "@/components/ScholarAvatar";

describe("ScholarAvatar", () => {
  it("renders an <img> with the signed URL and meaningful alt text when src is present", () => {
    const html = renderToStaticMarkup(
      createElement(ScholarAvatar, {
        src: "https://example.supabase.co/signed/colombia/0987654321.webp?token=x",
        name: "Ana Gómez",
        size: "profile",
      }),
    );

    expect(html).toContain("<img");
    expect(html).toContain(
      'src="https://example.supabase.co/signed/colombia/0987654321.webp?token=x"',
    );
    expect(html).toContain("Ana Gómez");
  });

  it("renders the initials fallback, not an <img>, when src is null", () => {
    const html = renderToStaticMarkup(
      createElement(ScholarAvatar, { src: null, name: "Ana Gómez", size: "profile" }),
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("AG");
  });
});
