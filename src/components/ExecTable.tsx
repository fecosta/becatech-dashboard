// Executive cohort/segment table — the dominant table shape in
// design-reference/MVP_Dashboard AUGUST 4.html (`.exec-table`): black header row,
// a left-aligned label column, right-aligned numeric columns, and filled summary
// rows in brand colors.
//
// Deliberately separate from DataTable. DataTable is a generic Column<T>[] renderer
// over a homogeneous row type; this is a matrix whose summary rows are semantically
// not of that type (a "· TARGET" row is a goal, not a cohort), so forcing them
// through Column<T> would mean polluting every caller's row type with a
// discriminator, or rendering summary rows outside the component and losing them.
import type { ReactNode } from "react";

/** Filled summary rows. `actual` = the observed roll-up, `goal` = the program
 *  target, `col`/`per` = the per-country averages. */
export type ExecSummaryTone = "actual" | "goal" | "col" | "per";

export interface ExecRow {
  /** Left-hand label cell. */
  label: ReactNode;
  /** One entry per header after the first; short/long arrays are padded/truncated. */
  cells: ReactNode[];
  /** Muted italic row — the design's "Not applicable" rows for a cohort that had
   *  not started in that term. */
  na?: boolean;
  summary?: ExecSummaryTone;
  /** Overrides the label as the React key when labels can repeat. */
  key?: string;
}

const SUMMARY_BG: Record<ExecSummaryTone, string> = {
  actual: "bg-surface-dark",
  goal: "bg-green",
  col: "bg-purple",
  per: "bg-purple-deep",
};

export function ExecTable({
  headers,
  rows,
  caption,
  empty = "No data for the current selection.",
}: {
  /** First entry labels the left column; the rest are the numeric columns. */
  headers: ReactNode[];
  rows: ExecRow[];
  /** Muted note under the table (the design's `.journey-note`). */
  caption?: ReactNode;
  empty?: ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }

  const valueColumnCount = Math.max(0, headers.length - 1);

  return (
    <div>
      {/* Wide tables (the 7-column contact list, the 6-level English breakdown)
          scroll inside the card rather than pushing the page sideways. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`whitespace-nowrap bg-surface-dark px-3.5 py-[11px] text-xs font-bold text-white ${
                    i === 0 ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              // Normalise width so a short row can never shift the columns.
              const cells = Array.from({ length: valueColumnCount }, (_, i) => row.cells[i] ?? null);
              // Label and value cells get their colour independently rather than
              // layering conflicting Tailwind classes, which resolve by stylesheet
              // order rather than by the order they appear in the string.
              const chrome = row.summary
                ? `${SUMMARY_BG[row.summary]} border-white/25`
                : "border-border";
              const valueText = row.summary
                ? "font-extrabold text-white"
                : row.na
                  ? "italic text-muted"
                  : "text-ink";
              const labelText = row.summary
                ? "font-extrabold text-white"
                : row.na
                  ? "font-bold italic text-muted"
                  : "font-bold text-surface-dark";
              return (
                <tr key={row.key ?? `${rowIndex}`}>
                  <td className={`border-b px-3.5 py-2.5 text-left ${chrome} ${labelText}`}>
                    {row.label}
                  </td>
                  {cells.map((c, i) => (
                    <td key={i} className={`border-b px-3.5 py-2.5 text-right ${chrome} ${valueText}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {caption ? <p className="mt-3.5 text-[12.5px] text-muted">{caption}</p> : null}
    </div>
  );
}
