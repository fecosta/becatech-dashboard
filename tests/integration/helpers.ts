import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";

/** Delete all rows (child → parent) between tests. */
export async function resetDb(): Promise<void> {
  await prisma.userScholarAccess.deleteMany();
  await prisma.selectionStageHistory.deleteMany();
  await prisma.selectionCandidate.deleteMany();
  await prisma.dataQualityIssue.deleteMany();
  await prisma.financialInput.deleteMany();
  await prisma.riskAssessment.deleteMany();
  await prisma.supportActivity.deleteMany();
  await prisma.scholarRequest.deleteMany();
  await prisma.mentorReport.deleteMany();
  await prisma.monthlyCheckin.deleteMany();
  await prisma.academicTerm.deleteMany();
  await prisma.rawJotformSubmission.deleteMany();
  await prisma.dataImportBatch.deleteMany();
  await prisma.controlValue.deleteMany();
  await prisma.syncLock.deleteMany();
  await prisma.appUser.deleteMany();
  await prisma.scholar.deleteMany();
  await prisma.university.deleteMany();
  await prisma.operator.deleteMany();
}

/** Minimal baseline: an analyst uploader, controlled lists, and one scholar. */
export async function seedFixture(): Promise<{ uploaderId: string }> {
  await prisma.appUser.create({
    data: {
      id: "test-analyst",
      fullName: "Test Analyst",
      email: "test-analyst@becatech.test",
      role: "ANALYST_ADMIN",
    },
  });
  // System user the sync endpoint (POST /api/sync/import) attributes its batches to.
  await prisma.appUser.create({
    data: {
      id: "test-sheets-sync",
      fullName: "Google Sheets Sync",
      email: "sheets-sync@becatech.internal",
      role: "ANALYST_ADMIN",
    },
  });

  const controls: { category: string; value: string; label: string }[] = [];
  const add = (category: string, values: string[]) =>
    values.forEach((v) => controls.push({ category, value: v, label: v }));
  add("country", ["COLOMBIA", "PERU"]);
  add("program_status", ["ACTIVE", "WITHDRAWN", "GRADUATED", "PAUSED"]);
  add("activity_type", [
    "INDIVIDUAL_TUTORING",
    "GROUP_TUTORING",
    "INDIVIDUAL_MENTORING",
    "GROUP_MENTORING",
    "WORKSHOP",
    "OTHER",
  ]);
  add("cost_category", ["Tuition", "Scholarship amount"]);
  add("academic_progress_status", ["ON_TRACK", "SLIGHTLY_BEHIND", "BEHIND", "CRITICAL_DELAY"]);
  add("request_status", ["SUBMITTED", "IN_REVIEW", "RESOLVED", "REJECTED", "PENDING"]);
  await prisma.controlValue.createMany({ data: controls });

  const university = await prisma.university.create({
    data: { name: "UNAL", country: "COLOMBIA", city: "Bogotá", type: "PUBLIC" },
  });

  await prisma.scholar.create({
    data: {
      scholarId: "BT-CO-001",
      fullName: "Fixture Scholar",
      country: "COLOMBIA",
      cohort: "2025",
      universityId: university.id,
      academicProgram: "CS",
      gender: "Female",
      programStatus: "ACTIVE",
    },
  });

  return { uploaderId: "test-analyst" };
}

/** A second scholar sharing seedFixture()'s scholar's fullName exactly — for exercising
 * ambiguous-name resolution (MENTOR_REPORT's scholarId-by-name lookup). Opt-in, not part of the
 * shared seedFixture() baseline, since every other test assumes exactly one scholar exists. */
export async function seedAmbiguousNamesake(): Promise<{ scholarId: string }> {
  const university = await prisma.university.findFirstOrThrow();
  const scholar = await prisma.scholar.create({
    data: {
      scholarId: "BT-CO-002",
      fullName: "Fixture Scholar",
      country: "COLOMBIA",
      cohort: "2025",
      universityId: university.id,
      academicProgram: "CS",
      gender: "Female",
      programStatus: "ACTIVE",
    },
  });
  return { scholarId: scholar.scholarId };
}

/** A single real-shaped Operator row — opt-in, not part of the shared seedFixture() baseline
 * (most tests don't need an operator catalog at all). */
export async function seedOperatorFixture(): Promise<{ operatorId: string; name: string }> {
  const operator = await prisma.operator.create({
    data: { name: "Fundación Antivirus para la Deserción", country: "COLOMBIA", track: "EARLY_SUPPORT" },
  });
  return { operatorId: operator.id, name: operator.name };
}

export function csvBuffer(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function xlsxBuffer(aoa: unknown[][]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return new Uint8Array(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
