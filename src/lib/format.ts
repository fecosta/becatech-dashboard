// Small display formatters for the dashboard UI.

export const fmtInt = (n: number): string =>
  new Intl.NumberFormat("en-US").format(Math.round(n));

export const fmtUsd = (n: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export const fmtPct = (fraction: number, digits = 0): string =>
  `${(fraction * 100).toFixed(digits)}%`;

export const fmtGpa = (n: number | null | undefined): string =>
  n == null ? "—" : n.toFixed(2);

export const fmtDate = (d: Date | string | null | undefined): string =>
  d ? new Date(d).toISOString().slice(0, 10) : "—";
