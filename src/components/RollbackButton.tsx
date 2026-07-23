"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RollbackButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rollback() {
    if (!window.confirm("Roll back this import? The rows created by this batch will be deleted.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/imports/${batchId}/rollback`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Failed to roll back.");
      else router.refresh();
    } catch {
      setError("Could not roll back.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={rollback}
        disabled={busy}
        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
      >
        {busy ? "Rolling back…" : "Roll back import"}
      </button>
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
