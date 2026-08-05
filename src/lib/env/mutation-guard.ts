// Environment safety for data mutations.
//
// Preview deployments on Vercel share the PRODUCTION database (there is no per-branch database
// isolation — see the build script, which already skips `prisma migrate deploy` unless
// VERCEL_ENV === "production", and the deployment notes). That means any data mutation made from a
// Preview deployment writes directly to production data. This module blocks those mutations, fail
// closed: a Preview environment can read but never write.
//
// VERCEL_ENV is "production" | "preview" | "development" on Vercel, and undefined for local dev.
// Only "preview" is blocked — production and local development are allowed.
import { NextResponse } from "next/server";

export function vercelEnv(): string | undefined {
  return process.env.VERCEL_ENV;
}

export function isPreviewEnvironment(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

/**
 * Human-readable reason a data mutation is blocked in the current environment, or null when it is
 * allowed (production + local development). Pure and testable — the API-route helper below turns a
 * non-null reason into a 403 response.
 */
export function mutationBlockReason(): string | null {
  if (isPreviewEnvironment()) {
    return "Data changes are disabled in the Preview environment because it shares the production database. Run this against Production or a local environment instead.";
  }
  return null;
}

/**
 * For API routes: returns a 403 NextResponse when the current environment must not mutate data, or
 * null when the caller may proceed. Call this AFTER authentication/authorization and BEFORE any
 * write, in every route that mutates data (sync, import create/commit/rollback).
 */
export function blockMutationInUnsafeEnvironment(): NextResponse | null {
  const reason = mutationBlockReason();
  return reason ? NextResponse.json({ error: reason }, { status: 403 }) : null;
}
