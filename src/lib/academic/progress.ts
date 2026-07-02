// Academic progress classification. Compares a scholar's actual progress against
// the progress expected by this point in their program (brief §8.2).
import { AcademicProgressStatus } from "../../generated/prisma/enums";

/**
 * Bucket actual-vs-expected progress:
 *   ON_TRACK        ratio >= 0.90
 *   SLIGHTLY_BEHIND ratio >= 0.75
 *   BEHIND          ratio >= 0.50
 *   CRITICAL_DELAY  ratio <  0.50
 * where ratio = actualProgressPct / expectedProgressPct.
 */
export function deriveExpectedProgressStatus(
  actualProgressPct: number,
  expectedProgressPct: number,
): AcademicProgressStatus {
  if (expectedProgressPct <= 0) return AcademicProgressStatus.ON_TRACK;

  const ratio = actualProgressPct / expectedProgressPct;
  if (ratio >= 0.9) return AcademicProgressStatus.ON_TRACK;
  if (ratio >= 0.75) return AcademicProgressStatus.SLIGHTLY_BEHIND;
  if (ratio >= 0.5) return AcademicProgressStatus.BEHIND;
  return AcademicProgressStatus.CRITICAL_DELAY;
}
