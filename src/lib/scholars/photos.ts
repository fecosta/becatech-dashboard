// Scholar photo resolution: signed URLs for the private "scholar-photos" Supabase
// Storage bucket, for the individual Scholar Profile page. First phase: Colombia only
// (resources/tasks/active/001-task-scholar-photos.md). Centralizes the storage-path
// convention and the signed-URL TTL so neither is duplicated or hardcoded in
// components — see src/components/ScholarProfileView.tsx for the only call site.
//
// Callers are responsible for authorization: this module performs no access check of
// its own. It must only be called after the caller has already established that the
// current user may view this scholarId.
import type { Country } from "@/generated/prisma/enums";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const SCHOLAR_PHOTOS_BUCKET = "scholar-photos";

/** How long a signed scholar-photo URL stays valid, in seconds. One place to tune. */
export const SCHOLAR_PHOTO_SIGNED_URL_TTL_SECONDS = 60;

/**
 * Country -> storage folder. Only Colombia photos exist today (task doc §11). A country
 * with no entry here must resolve to "no photo" with zero Storage/network calls — that
 * is a different, safer thing than an entry that happens to point somewhere wrong, so
 * absence-of-a-key is the only "Peru" behavior, not an explicit no-op mapping.
 */
const COUNTRY_FOLDERS: Partial<Record<Country, string>> = {
  COLOMBIA: "colombia",
};

/**
 * Builds the storage object path for a scholar's photo, or null when the scholar's
 * country has no configured photo folder (Peru, for now).
 *
 * scholarId is used verbatim: never lowercased, trimmed, or parsed as a number.
 * Leading zeros (e.g. "0987654321") are significant and must survive unchanged.
 */
export function getScholarPhotoPath({
  scholarId,
  country,
}: {
  scholarId: string;
  country: Country;
}): string | null {
  const folder = COUNTRY_FOLDERS[country];
  if (!folder) return null;
  return `${folder}/${scholarId}.webp`;
}

/**
 * Resolves a short-lived signed URL for a scholar's photo, or null when there is no
 * photo (unsupported country, no uploaded object) or the Storage call could not
 * complete (misconfiguration, auth, network). Never throws — the Scholar Profile must
 * keep rendering regardless of photo availability.
 */
export async function getScholarPhotoUrl({
  scholarId,
  country,
}: {
  scholarId: string;
  country: Country;
}): Promise<string | null> {
  const path = getScholarPhotoPath({ scholarId, country });
  if (!path) return null;

  const client = getSupabaseAdminClient();
  if (!client) {
    // Not "an error happened" — more often "nobody has set SUPABASE_SERVICE_ROLE_KEY in
    // this environment yet" (e.g. local dev). Distinct, lower severity than a live
    // Storage-call failure below.
    console.warn(
      `[scholar-photos] Supabase admin client is not configured; skipping photo for ${scholarId}.`,
    );
    return null;
  }

  try {
    const { data, error } = await client.storage
      .from(SCHOLAR_PHOTOS_BUCKET)
      .createSignedUrl(path, SCHOLAR_PHOTO_SIGNED_URL_TTL_SECONDS);

    if (error) {
      // Supabase Storage reports a missing object as a 404-shaped StorageError.
      // statusCode is a string field on the body; status is the outer HTTP status.
      const isMissingObject = error.statusCode === "404" || error.status === 404;
      if (isMissingObject) return null; // expected: most scholars have no photo yet.

      console.error(
        `[scholar-photos] unexpected Storage error resolving ${path}: ${error.message}`,
        { status: error.status, statusCode: error.statusCode },
      );
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    // Defensive only: createSignedUrl resolves { data: null, error } for ordinary API
    // failures rather than throwing (see @supabase/storage-js's BaseApiClient) — this
    // catch exists for a genuinely unexpected, non-StorageError throw.
    console.error(`[scholar-photos] unexpected exception resolving ${path}`, err);
    return null;
  }
}
