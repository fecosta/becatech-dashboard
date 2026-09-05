-- ADR-008: add `semester` to RiskAssessment's identity, closing the cross-semester collision
-- where the same program month ("MES n") in two different semesters shared one row.
--
-- This is the first hand-edited migration in this repo (all prior migrations are unedited
-- Prisma-generated diffs). Ordering matters: add the nullable column, backfill it from
-- MentorReport where determinable, THEN replace the unique index — the backfill runs against
-- the old 2-column index still in place, and the new 3-column unique index below assumes the
-- column already has whatever values the backfill could recover.
--
-- Never edit this file after it has shipped — add a new migration instead (see
-- docs/adr/005-prisma-migrations.md).

-- AlterTable
ALTER TABLE "RiskAssessment" ADD COLUMN "semester" TEXT;

-- Backfill: recover `semester` for existing rows by joining back to MentorReport on
-- (scholarId, canonicalized period). The canonicalization mirrors
-- src/lib/risk/from-mentor-report.ts::programMonthKey() exactly, including its Number()-style
-- leading-zero stripping ("mes 06" -> "MES 6", not "MES 06") -- a naive digit-concatenation
-- would silently fail to match any zero-padded sheet value.
--
-- Only backfill a (scholarId, period) pair when every matching MentorReport row agrees on a
-- single, non-blank semester (COUNT(DISTINCT semester) = 1) -- never guess when reports for the
-- same scholar-month disagree, and never touch a row that already has a value. Pairs with no
-- matching MentorReport at all (seed-created rows, hand-entered MONTHLY_STATUS rows, or legacy
-- junk periods) are left untouched by the join (a no-op, not an error) and keep semester = NULL --
-- see the ADR for why this residual gap is accepted rather than fabricated.
WITH mentor_period AS (
  SELECT
    "scholarId",
    CASE
      WHEN "reportingMonth" ~* '^mes\s*[0-9]+$'
        THEN 'MES ' || (regexp_replace("reportingMonth", '^mes\s*([0-9]+)$', '\1', 'i'))::int::text
      ELSE trim("reportingMonth")
    END AS period,
    trim("semester") AS semester
  FROM "MentorReport"
  WHERE "reportingMonth" IS NOT NULL
    AND trim("reportingMonth") <> ''
    AND "semester" IS NOT NULL
    AND trim("semester") <> ''
),
unambiguous AS (
  SELECT "scholarId", period, min(semester) AS semester
  FROM mentor_period
  GROUP BY "scholarId", period
  HAVING count(DISTINCT semester) = 1
)
UPDATE "RiskAssessment" ra
SET "semester" = u.semester
FROM unambiguous u
WHERE ra."scholarId" = u."scholarId"
  AND ra."period" = u.period
  AND ra."semester" IS NULL;

-- DropIndex
DROP INDEX "RiskAssessment_scholarId_period_key";

-- CreateIndex
CREATE INDEX "RiskAssessment_semester_period_idx" ON "RiskAssessment"("semester", "period");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_scholarId_semester_period_key" ON "RiskAssessment"("scholarId", "semester", "period");
