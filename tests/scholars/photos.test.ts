import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: vi.fn() }));

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getScholarPhotoPath,
  getScholarPhotoUrl,
  SCHOLAR_PHOTO_SIGNED_URL_TTL_SECONDS,
  SCHOLAR_PHOTOS_BUCKET,
} from "@/lib/scholars/photos";

afterEach(() => {
  vi.clearAllMocks();
});

describe("getScholarPhotoPath", () => {
  it("resolves a Colombia scholar into the colombia/ folder, preserving leading zeros", () => {
    expect(getScholarPhotoPath({ scholarId: "0987654321", country: "COLOMBIA" })).toBe(
      "colombia/0987654321.webp",
    );
  });

  it("returns null for a country with no configured photo folder (Peru, for now)", () => {
    expect(getScholarPhotoPath({ scholarId: "1234567890", country: "PERU" })).toBeNull();
  });
});

function mockCreateSignedUrl(result: { data: { signedUrl: string } | null; error: unknown }) {
  const createSignedUrl = vi.fn().mockResolvedValue(result);
  const from = vi.fn().mockReturnValue({ createSignedUrl });
  vi.mocked(getSupabaseAdminClient).mockReturnValue({
    storage: { from },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return { createSignedUrl, from };
}

describe("getScholarPhotoUrl", () => {
  it("requests the exact expected object path and returns the signed URL", async () => {
    const { createSignedUrl, from } = mockCreateSignedUrl({
      data: { signedUrl: "https://example.supabase.co/signed/colombia/0987654321.webp?token=x" },
      error: null,
    });

    const url = await getScholarPhotoUrl({ scholarId: "0987654321", country: "COLOMBIA" });

    expect(from).toHaveBeenCalledWith(SCHOLAR_PHOTOS_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith(
      "colombia/0987654321.webp",
      SCHOLAR_PHOTO_SIGNED_URL_TTL_SECONDS,
    );
    expect(url).toBe("https://example.supabase.co/signed/colombia/0987654321.webp?token=x");
  });

  it("never touches the Storage client for an unsupported country", async () => {
    mockCreateSignedUrl({ data: null, error: null });

    const url = await getScholarPhotoUrl({ scholarId: "1234567890", country: "PERU" });

    expect(url).toBeNull();
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("resolves a missing-object Storage error to null, silently (not an application error)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateSignedUrl({
      data: null,
      error: { message: "Object not found", statusCode: "404", status: 400 },
    });

    await expect(
      getScholarPhotoUrl({ scholarId: "0987654321", country: "COLOMBIA" }),
    ).resolves.toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("resolves an unexpected Storage error to null, but logs it distinctly", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateSignedUrl({
      data: null,
      error: { message: "Invalid API key", statusCode: "401", status: 401 },
    });

    await expect(
      getScholarPhotoUrl({ scholarId: "0987654321", country: "COLOMBIA" }),
    ).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("returns null without throwing when the admin client is not configured", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(getSupabaseAdminClient).mockReturnValue(null);

    await expect(
      getScholarPhotoUrl({ scholarId: "0987654321", country: "COLOMBIA" }),
    ).resolves.toBeNull();
  });
});
