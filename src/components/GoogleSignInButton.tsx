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
        "El inicio de sesión con Google no está configurado en este entorno. Usa DEMO_USER_EMAIL para desarrollo local.",
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
      setError("No se pudo iniciar sesión con Google.");
      setBusy(false);
    }
    // On success the browser navigates away to Google's consent screen.
  }

  return (
    <div>
      <button
        onClick={signIn}
        disabled={busy}
        className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? "Redirigiendo…" : "Iniciar sesión con Google"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
