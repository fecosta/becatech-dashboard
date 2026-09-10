// Chip tones, shared by the presentational chips in ui.tsx and the interactive block filter
// selects in FilterSelect.tsx. Kept in its own constants-only module so a client component can
// import the tone classes without pulling all of ui.tsx into the client bundle.
export type ChipTone = "black" | "green" | "purple" | "yellow" | "ghost";

export const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  black: "bg-surface-dark text-white border-black",
  green: "bg-green text-white border-green-dark",
  purple: "bg-purple text-white border-purple-dark",
  yellow: "bg-yellow text-surface-dark border-yellow-dark",
  ghost: "bg-card text-ink border-border shadow-none",
};
