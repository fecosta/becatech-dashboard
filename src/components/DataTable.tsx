// Simple, readable, generic table. Presentational — safe in server components.
import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  empty = "Sin datos",
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                className={`px-4 py-2.5 text-left font-medium text-slate-500 ${c.className ?? ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-slate-50">
                {columns.map((c, ci) => (
                  <td key={ci} className={`px-4 py-2.5 text-slate-700 ${c.className ?? ""}`}>
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
