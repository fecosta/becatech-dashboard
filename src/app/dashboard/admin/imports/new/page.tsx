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
      setError("Selecciona un archivo.");
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
      if (!res.ok) setError(json.error ?? "Error al validar el archivo.");
      else setPreview(json as Preview);
    } catch {
      setError("No se pudo procesar el archivo.");
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
      if (!res.ok) setError(json.error ?? "Error al confirmar la importación.");
      else setCommitted(json as CommitResult);
    } catch {
      setError("No se pudo confirmar la importación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/admin/imports" className="text-xs text-slate-500 hover:underline">
        ← Volver a importaciones
      </Link>
      <h1 className="mt-1 mb-6 text-xl font-semibold text-slate-900">Nueva importación</h1>

      {/* Step 1: source + file */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">Formato de origen</label>
        <div className="mt-2 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={sourceType === "TEMPLATE"} onChange={() => setSourceType("TEMPLATE")} />
            Plantilla (una entidad)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={sourceType === "LEGACY_WIDE_EXCEL"}
              onChange={() => setSourceType("LEGACY_WIDE_EXCEL")}
            />
            Excel histórico (ancho)
          </label>
        </div>

        {sourceType === "TEMPLATE" ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Entidad</label>
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
              Descargar plantilla
            </a>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Las entidades presentes en el archivo se detectan automáticamente.
          </p>
        )}

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">Archivo (.xlsx o .csv)</label>
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
            {busy && !preview ? "Validando…" : "Vista previa"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {/* Step 2: preview */}
      {preview ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Vista previa</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Filas" value={preview.totalRows} />
            <Stat label="Válidas" value={preview.successRows} tone="green" />
            <Stat label="Con error" value={preview.errorRows} tone={preview.errorRows ? "red" : "slate"} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Entidades: {preview.entities.map((e) => IMPORT_ENTITY_LABEL[e] ?? e).join(", ") || "—"}
          </p>

          {preview.errors.length > 0 ? (
            <div className="mt-4 max-h-64 overflow-auto rounded-md border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-1.5">Fila</th>
                    <th className="px-3 py-1.5">Entidad</th>
                    <th className="px-3 py-1.5">Campo</th>
                    <th className="px-3 py-1.5">Mensaje</th>
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
              {busy ? "Confirmando…" : `Confirmar ${preview.successRows} fila(s) válida(s)`}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Step 3: result */}
      {committed ? (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-sm font-semibold text-emerald-900">Importación confirmada</h2>
          <p className="mt-1 text-sm text-emerald-800">
            {committed.successRows} fila(s) aplicada(s).
            {committed.triggeredRiskRecompute
              ? ` Riesgo recalculado en ${committed.recomputed} periodo(s).`
              : " Sin recálculo de riesgo."}
          </p>
          <div className="mt-3 flex gap-3 text-sm">
            <Link href="/dashboard/admin/imports" className="font-medium text-emerald-900 underline">
              Ver historial
            </Link>
            <Link href={`/dashboard/admin/imports/${preview?.batchId}`} className="font-medium text-emerald-900 underline">
              Ver detalle
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
