// Simple, readable, generic table. Presentational — safe in server components.
//
// Distinct from ExecTable: this is column-driven over a homogeneous row type and is
// used by the scholar directory, the selection pipeline and the admin screens.
// ExecTable is the design's executive matrix with typed summary rows.
import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  empty = "No data",
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-chip-cream">
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                className={`px-4 py-2.5 text-left font-semibold text-muted ${c.className ?? ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-cream">
                {columns.map((c, ci) => (
                  <td key={ci} className={`px-4 py-2.5 text-ink ${c.className ?? ""}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
