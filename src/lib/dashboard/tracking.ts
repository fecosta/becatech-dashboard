// Tracking workspace: one route (/dashboard/tracking) with query-param tabs.
// Kept framework-agnostic (no React / next imports) so it's usable from the server
// page, the client tab strip, and unit tests alike.

export const TRACKING_TABS = ["summary", "years-1-2", "years-3-5", "scholars"] as const;
export type TrackingTab = (typeof TRACKING_TABS)[number];

export const TRACKING_TAB_LABEL: Record<TrackingTab, string> = {
  summary: "Resumen",
  "years-1-2": "Años 1–2",
  "years-3-5": "Años 3–5",
  scholars: "Progreso del becario",
};

/** Any unknown/missing value falls back to "summary" (Nav spec §5). */
export function parseTrackingTab(value: string | string[] | undefined): TrackingTab {
  const v = Array.isArray(value) ? value[0] : value;
  return (TRACKING_TABS as readonly string[]).includes(v ?? "") ? (v as TrackingTab) : "summary";
}
