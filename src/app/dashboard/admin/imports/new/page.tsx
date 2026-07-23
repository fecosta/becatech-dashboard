"use client";

import Link from "next/link";
import { useState } from "react";
import { IMPORT_ENTITIES, IMPORT_ENTITY_LABEL } from "@/lib/labels";

interface RowError {
  entity: string;
  rowNumber: number;
  field: string;
  message: string;
}
interface Preview {
  batchId: string;
  entities: string[];
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: RowError[];
}
interface CommitResult {
  successRows: number;
  triggeredRiskRecompute: boolean;
  recomputed: number;
}

type SourceType = "TEMPLATE" | "LEGACY_WIDE_EXCEL";

export default function NewImportPage() {
  const [sourceType, setSourceType] = useState<SourceType>("TEMPLATE");
  const [entity, setEntity] = useState<string>("SCHOLAR");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [committed, setCommitted] = useState<CommitResult | null>(null);

  async function runPreview() {
    if (!file) {
      setError("Select a file.");
      return;
    }
    setBusy(true);
    setError(null);
    setPreview(null);
    setCommitted(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("sourceType", sourceType);
      if (sourceType === "TEMPLATE") form.set("entity", entity);
      const res = await fetch("/api/admin/imports", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Failed to validate the file.");
      else setPreview(json as Preview);
    } catch {
      setError("Could not process the file.");
    } finally {
      setBusy(false);
    }
  }

  async function runCommit() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/imports/${preview.batchId}/commit`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Failed to commit the import.");
      else setCommitted(json as CommitResult);
    } catch {
      setError("Could not commit the import.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/admin/imports" className="text-xs text-muted hover:underline">
        ← Back to imports
      </Link>
      <h1 className="mt-1 mb-6 text-xl font-semibold text-ink">New import</h1>

      {/* Step 1: source + file */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-ink">Source format</label>
        <div className="mt-2 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={sourceType === "TEMPLATE"} onChange={() => setSourceType("TEMPLATE")} />
            Template (single entity)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={sourceType === "LEGACY_WIDE_EXCEL"}
              onChange={() => setSourceType("LEGACY_WIDE_EXCEL")}
            />
            Legacy Excel (wide)
          </label>
        </div>

        {sourceType === "TEMPLATE" ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-ink">Entity</label>
              <select
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                {IMPORT_ENTITIES.map((e) => (
                  <option key={e} value={e}>
                    {IMPORT_ENTITY_LABEL[e]}
                  </option>
                ))}
              </select>
            </div>
            <a
              href={`/api/admin/imports/template/${entity}`}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              Download template
            </a>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">
            Entities present in the file are detected automatically.
          </p>
        )}

        <div className="mt-4">
          <label className="block text-sm font-medium text-ink">File (.xlsx or .csv)</label>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block text-sm"
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={runPreview}
            disabled={busy || !file}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy && !preview ? "Validating…" : "Preview"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {/* Step 2: preview */}
      {preview ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-ink">Preview</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Rows" value={preview.totalRows} />
            <Stat label="Valid" value={preview.successRows} tone="green" />
            <Stat label="With errors" value={preview.errorRows} tone={preview.errorRows ? "red" : "slate"} />
          </div>
          <p className="mt-3 text-xs text-muted">
            Entities: {preview.entities.map((e) => IMPORT_ENTITY_LABEL[e] ?? e).join(", ") || "—"}
          </p>

          {preview.errors.length > 0 ? (
            <div className="mt-4 max-h-64 overflow-auto rounded-md border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-1.5">Row</th>
                    <th className="px-3 py-1.5">Entity</th>
                    <th className="px-3 py-1.5">Field</th>
                    <th className="px-3 py-1.5">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.errors.map((e, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{e.rowNumber}</td>
                      <td className="px-3 py-1.5">{IMPORT_ENTITY_LABEL[e.entity] ?? e.entity}</td>
                      <td className="px-3 py-1.5">{e.field}</td>
                      <td className="px-3 py-1.5 text-red-700">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!committed ? (
            <button
              onClick={runCommit}
              disabled={busy || preview.successRows === 0}
              className="mt-4 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Committing…" : `Commit ${preview.successRows} valid row(s)`}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Step 3: result */}
      {committed ? (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-sm font-semibold text-emerald-900">Import committed</h2>
          <p className="mt-1 text-sm text-emerald-800">
            {committed.successRows} row(s) applied.
            {committed.triggeredRiskRecompute
              ? ` Risk recomputed for ${committed.recomputed} period(s).`
              : " No risk recompute."}
          </p>
          <div className="mt-3 flex gap-3 text-sm">
            <Link href="/dashboard/admin/imports" className="font-medium text-emerald-900 underline">
              View history
            </Link>
            <Link href={`/dashboard/admin/imports/${preview?.batchId}`} className="font-medium text-emerald-900 underline">
              View detail
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "green" | "red" }) {
  const color = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
