// Data-quality scanner (brief §13). Detects the catalogued issue types over the
// current database and (optionally) records them in DataQualityIssue.
//
// Note: a few catalogued issues can't occur given the schema — "missing/duplicate
// scholar id" (primary key) and "unknown country" (enum) — so they are omitted.
import { ProgramStatus } from "../../generated/prisma/enums";
import { prisma } from "../db";

export interface DetectedIssue {
  issueType: string;
  sourceName: string;
  recordId?: string;
  scholarId?: string;
  issueDescription: string;
  severity: "low" | "medium" | "high";
}

const SCANNER_OWNER = "data-quality-scanner";

export async function scanDataQuality(): Promise<DetectedIssue[]> {
  const issues: DetectedIssue[] = [];

  const scholars = await prisma.scholar.findMany({
    select: { scholarId: true, cohort: true, programStatus: true },
  });
  const scholarIds = new Set(scholars.map((s) => s.scholarId));
  const activeIds = scholars
    .filter((s) => s.programStatus === ProgramStatus.ACTIVE)
    .map((s) => s.scholarId);

  // Missing cohort on the scholar record. (Missing university can no longer occur —
  // Scholar.universityId is a required foreign key to the University table.)
  for (const s of scholars) {
    if (!s.cohort?.trim()) {
      issues.push({
        issueType: "MISSING_COHORT",
        sourceName: "Scholar",
        scholarId: s.scholarId,
        issueDescription: "Scholar has no cohort.",
        severity: "medium",
      });
    }
  }

  // Check-ins / mentor reports without a matching scholar, or missing reporting month.
  const checkins = await prisma.monthlyCheckin.findMany({
    select: { id: true, scholarId: true, reportingMonth: true },
  });
  for (const c of checkins) {
    if (!scholarIds.has(c.scholarId)) {
      issues.push({
        issueType: "CHECKIN_WITHOUT_SCHOLAR",
        sourceName: "MonthlyCheckin",
        recordId: c.id,
        scholarId: c.scholarId,
        issueDescription: "Check-in references an unknown scholar.",
        severity: "high",
      });
    }
    if (!c.reportingMonth?.trim()) {
      issues.push({
        issueType: "MISSING_REPORTING_MONTH",
        sourceName: "MonthlyCheckin",
        recordId: c.id,
        scholarId: c.scholarId,
        issueDescription: "Check-in has no reporting month.",
        severity: "low",
      });
    }
  }

  const mentorReports = await prisma.mentorReport.findMany({
    select: { id: true, scholarId: true },
  });
  for (const m of mentorReports) {
    if (!scholarIds.has(m.scholarId)) {
      issues.push({
        issueType: "MENTOR_REPORT_WITHOUT_SCHOLAR",
        sourceName: "MentorReport",
        recordId: m.id,
        scholarId: m.scholarId,
        issueDescription: "Mentor report references an unknown scholar.",
        severity: "high",
      });
    }
  }

  // Invalid GPA (outside 0–5).
  const badGpa = await prisma.academicTerm.findMany({
    where: { OR: [{ gpa: { lt: 0 } }, { gpa: { gt: 5 } }] },
    select: { id: true, scholarId: true, gpa: true, term: true },
  });
  for (const t of badGpa) {
    issues.push({
      issueType: "INVALID_GPA",
      sourceName: "AcademicTerm",
      recordId: t.id,
      scholarId: t.scholarId,
      issueDescription: `GPA ${t.gpa} out of range in ${t.term}.`,
      severity: "high",
    });
  }

  // Risk values out of range, or assessments missing source/reason.
  const badRisk = await prisma.riskAssessment.findMany({
    where: { OR: [{ globalRiskValue: { lt: 0 } }, { globalRiskValue: { gt: 4 } }] },
    select: { id: true, scholarId: true, period: true, globalRiskValue: true },
  });
  for (const r of badRisk) {
    issues.push({
      issueType: "INVALID_RISK_VALUE",
      sourceName: "RiskAssessment",
      recordId: r.id,
      scholarId: r.scholarId,
      issueDescription: `Global risk ${r.globalRiskValue} out of range in ${r.period}.`,
      severity: "high",
    });
  }
  const riskNoReason = await prisma.riskAssessment.findMany({
    where: { OR: [{ source: null }, { riskReason: null }] },
    select: { id: true, scholarId: true, period: true },
  });
  for (const r of riskNoReason) {
    issues.push({
      issueType: "RISK_WITHOUT_SOURCE_OR_REASON",
      sourceName: "RiskAssessment",
      recordId: r.id,
      scholarId: r.scholarId,
      issueDescription: `Risk assessment ${r.period} missing source or reason.`,
      severity: "medium",
    });
  }

  // Active scholars missing the latest month's check-in / mentor report.
  const [{ _max: checkinMax }, { _max: mentorMax }] = await Promise.all([
    prisma.monthlyCheckin.aggregate({ _max: { reportingMonth: true } }),
    prisma.mentorReport.aggregate({ _max: { reportingMonth: true } }),
  ]);
  if (checkinMax.reportingMonth) {
    const month = checkinMax.reportingMonth;
    const have = new Set(
      (
        await prisma.monthlyCheckin.findMany({
          where: { reportingMonth: month },
          select: { scholarId: true },
        })
      ).map((r) => r.scholarId),
    );
    for (const id of activeIds) {
      if (!have.has(id)) {
        issues.push({
          issueType: "MISSING_CHECKIN_ACTIVE",
          sourceName: "MonthlyCheckin",
          scholarId: id,
          issueDescription: `Active scholar has no check-in for ${month}.`,
          severity: "medium",
        });
      }
    }
  }
  if (mentorMax.reportingMonth) {
    const month = mentorMax.reportingMonth;
    const have = new Set(
      (
        await prisma.mentorReport.findMany({
          where: { reportingMonth: month },
          select: { scholarId: true },
        })
      ).map((r) => r.scholarId),
    );
    for (const id of activeIds) {
      if (!have.has(id)) {
        issues.push({
          issueType: "MISSING_MENTOR_REPORT_ACTIVE",
          sourceName: "MentorReport",
          scholarId: id,
          issueDescription: `Active scholar has no mentor report for ${month}.`,
          severity: "medium",
        });
      }
    }
  }

  // Duplicate submission ids within each JotForm-sourced table (unique constraints make
  // this rare, but the check catches bad imports). Done in JS to keep the types simple.
  const dupCheck = (table: string, ids: string[]) => {
    const seen = new Set<string>();
    const dups = new Set<string>();
    for (const id of ids) (seen.has(id) ? dups : seen).add(id);
    for (const id of dups) {
      issues.push({
        issueType: "DUPLICATE_SUBMISSION_ID",
        sourceName: table,
        issueDescription: `submissionId ${id} appears more than once.`,
        severity: "high",
      });
    }
  };
  dupCheck(
    "MonthlyCheckin",
    (await prisma.monthlyCheckin.findMany({ select: { submissionId: true } })).map((r) => r.submissionId),
  );
  dupCheck(
    "MentorReport",
    (await prisma.mentorReport.findMany({ select: { submissionId: true } })).map((r) => r.submissionId),
  );
  dupCheck(
    "ScholarRequest",
    (await prisma.scholarRequest.findMany({ select: { submissionId: true } })).map((r) => r.submissionId),
  );

  return issues;
}

/** Run the scan and (by default) persist results, replacing prior scanner rows. */
export async function runDataQualityScan(
  options: { persist?: boolean } = {},
): Promise<{ detected: DetectedIssue[]; persisted: number }> {
  const detected = await scanDataQuality();

  if (options.persist === false) return { detected, persisted: 0 };

  await prisma.dataQualityIssue.deleteMany({ where: { owner: SCANNER_OWNER } });
  if (detected.length > 0) {
    await prisma.dataQualityIssue.createMany({
      data: detected.map((d) => ({
        issueType: d.issueType,
        sourceName: d.sourceName,
        recordId: d.recordId ?? null,
        scholarId: d.scholarId ?? null,
        issueDescription: d.issueDescription,
        severity: d.severity,
        owner: SCANNER_OWNER,
        status: "OPEN",
      })),
    });
  }
  return { detected, persisted: detected.length };
}
