// Selection pipeline stage-transition rules (brief §12). Pure + easily testable.
//
// Rules:
//  - A candidate advances one step at a time through the normal path.
//  - A candidate can be REJECTED or WITHDRAWN from any non-terminal stage.
//  - SELECTED, REJECTED, WITHDRAWN are terminal — no further transitions
//    unless an admin explicitly resets the candidate.
import type { SelectionStage } from "../../generated/prisma/enums";

/** The normal forward path, in order. */
export const LINEAR_STAGES: SelectionStage[] = [
  "APPLICATION_RECEIVED",
  "ELIGIBILITY_REVIEW",
  "ASSESSMENT",
  "INTERVIEW",
  "FINAL_COMMITTEE",
  "SELECTED",
];

export const TERMINAL_STAGES: SelectionStage[] = ["SELECTED", "REJECTED", "WITHDRAWN"];

export function isTerminal(stage: SelectionStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

/** Whether `to` is a valid next stage from `from`. */
export function canTransition(from: SelectionStage, to: SelectionStage): boolean {
  if (from === to) return false;
  if (isTerminal(from)) return false; // terminal stages are frozen
  if (to === "REJECTED" || to === "WITHDRAWN") return true; // exit from any non-terminal stage
  const fromIdx = LINEAR_STAGES.indexOf(from);
  const toIdx = LINEAR_STAGES.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx === fromIdx + 1; // one step forward only
}

/** All stages reachable from `from`. */
export function allowedNextStages(from: SelectionStage): SelectionStage[] {
  if (isTerminal(from)) return [];
  const next: SelectionStage[] = [];
  const idx = LINEAR_STAGES.indexOf(from);
  if (idx >= 0 && idx + 1 < LINEAR_STAGES.length) next.push(LINEAR_STAGES[idx + 1]);
  next.push("REJECTED", "WITHDRAWN");
  return next;
}

/** Apply a transition, throwing on an invalid one. Returns the new stage. */
export function transition(from: SelectionStage, to: SelectionStage): SelectionStage {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid stage transition: ${from} -> ${to}`);
  }
  return to;
}

/** Admin-only reset back to the first stage (the only way out of a terminal stage). */
export function resetStage(): SelectionStage {
  return "APPLICATION_RECEIVED";
}
