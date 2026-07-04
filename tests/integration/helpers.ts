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
  await prisma.appUser.deleteMany();
  await prisma.scholar.deleteMany();
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

  const controls: { category: string; value: string; label: string }[] = [];
  const add = (category: string, values: string[]) =>
    values.forEach((v) => controls.push({ category, value: v, label: v }));
  add("country", ["COLOMBIA", "PERU"]);
  add("program_status", ["ACTIVE", "WITHDRAWN", "GRADUATED", "PAUSED"]);
  add("activity_type", ["INDIVIDUAL_TUTORING", "GROUP_TUTORING", "WORKSHOP", "OTHER"]);
  add("cost_category", ["Tuition", "Scholarship amount"]);
  add("academic_progress_status", ["ON_TRACK", "SLIGHTLY_BEHIND", "BEHIND", "CRITICAL_DELAY"]);
  add("request_status", ["SUBMITTED", "IN_REVIEW", "RESOLVED", "REJECTED", "PENDING"]);
  await prisma.controlValue.createMany({ data: controls });

  await prisma.scholar.create({
    data: {
      scholarId: "BT-CO-001",
      fullName: "Fixture Scholar",
      country: "COLOMBIA",
      cohort: "2025",
      university: "UNAL",
      academicProgram: "CS",
      gender: "Female",
      programStatus: "ACTIVE",
    },
  });

  return { uploaderId: "test-analyst" };
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
