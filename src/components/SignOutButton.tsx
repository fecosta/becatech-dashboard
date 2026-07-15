"use client";

import { useState } from "react";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } finally {
      // Hard navigation, not router.refresh()/push() — sign-out should discard the
      // Router Cache entirely so a stale RSC payload from an authenticated page
      // can't get reused after logout.
      window.location.href = "/login";
    }
  }

  return (
    <button
      onClick={signOut}
      disabled={busy}
      className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
    >
      {busy ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
