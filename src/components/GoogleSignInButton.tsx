"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function GoogleSignInButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (!isSupabaseConfigured()) {
      setError(
        "Google sign-in isn't configured in this environment. Use DEMO_USER_EMAIL for local development.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (signInError) {
      setError("Couldn't sign in with Google.");
      setBusy(false);
    }
    // On success the browser navigates away to Google's consent screen.
  }

  return (
    <div>
      <button
        onClick={signIn}
        disabled={busy}
        className="w-full rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-chip-cream disabled:opacity-50"
      >
        {busy ? "Redirecting…" : "Sign in with Google"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
