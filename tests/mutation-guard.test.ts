import { afterEach, describe, expect, it } from "vitest";
import { isPreviewEnvironment, mutationBlockReason } from "@/lib/env/mutation-guard";

const original = process.env.VERCEL_ENV;
afterEach(() => {
  if (original === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = original;
});

describe("mutation-guard (Preview shares the production database)", () => {
  it("blocks data mutations in the Preview environment", () => {
    process.env.VERCEL_ENV = "preview";
    expect(isPreviewEnvironment()).toBe(true);
    expect(mutationBlockReason()).toMatch(/Preview/);
  });

  it("allows data mutations in Production", () => {
    process.env.VERCEL_ENV = "production";
    expect(isPreviewEnvironment()).toBe(false);
    expect(mutationBlockReason()).toBeNull();
  });

  it("allows data mutations in local development (VERCEL_ENV unset)", () => {
    delete process.env.VERCEL_ENV;
    expect(isPreviewEnvironment()).toBe(false);
    expect(mutationBlockReason()).toBeNull();
  });
});
