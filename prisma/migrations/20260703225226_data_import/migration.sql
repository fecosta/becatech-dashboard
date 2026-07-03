-- CreateEnum
CREATE TYPE "DataImportSourceType" AS ENUM ('TEMPLATE', 'LEGACY_WIDE_EXCEL');

-- CreateEnum
CREATE TYPE "DataImportEntity" AS ENUM ('SCHOLAR', 'ACADEMIC_TERM', 'MONTHLY_CHECKIN', 'MENTOR_REPORT', 'SUPPORT_ACTIVITY', 'SCHOLAR_REQUEST', 'FINANCIAL_INPUT');

-- CreateEnum
CREATE TYPE "DataImportStatus" AS ENUM ('PENDING', 'VALIDATED', 'COMMITTED', 'FAILED');

-- AlterTable
ALTER TABLE "AcademicTerm" ADD COLUMN     "importBatchId" TEXT;

-- AlterTable
ALTER TABLE "FinancialInput" ADD COLUMN     "importBatchId" TEXT;

-- AlterTable
ALTER TABLE "MentorReport" ADD COLUMN     "importBatchId" TEXT;

-- AlterTable
ALTER TABLE "MonthlyCheckin" ADD COLUMN     "importBatchId" TEXT;

-- AlterTable
ALTER TABLE "Scholar" ADD COLUMN     "importBatchId" TEXT;

-- AlterTable
ALTER TABLE "ScholarRequest" ADD COLUMN     "importBatchId" TEXT;

-- AlterTable
ALTER TABLE "SupportActivity" ADD COLUMN     "importBatchId" TEXT;

-- CreateTable
CREATE TABLE "DataImportBatch" (
    "id" TEXT NOT NULL,
    "sourceType" "DataImportSourceType" NOT NULL,
    "entities" "DataImportEntity"[],
    "filename" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DataImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "parsedRows" JSONB,
    "errorReport" JSONB,
    "insertedRefs" JSONB,
    "triggeredRiskRecompute" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataImportBatch_uploadedById_idx" ON "DataImportBatch"("uploadedById");

-- CreateIndex
CREATE INDEX "DataImportBatch_status_idx" ON "DataImportBatch"("status");

-- CreateIndex
CREATE INDEX "AcademicTerm_importBatchId_idx" ON "AcademicTerm"("importBatchId");

-- CreateIndex
CREATE INDEX "FinancialInput_importBatchId_idx" ON "FinancialInput"("importBatchId");

-- CreateIndex
CREATE INDEX "MentorReport_importBatchId_idx" ON "MentorReport"("importBatchId");

-- CreateIndex
CREATE INDEX "MonthlyCheckin_importBatchId_idx" ON "MonthlyCheckin"("importBatchId");

-- CreateIndex
CREATE INDEX "Scholar_importBatchId_idx" ON "Scholar"("importBatchId");

-- CreateIndex
CREATE INDEX "ScholarRequest_importBatchId_idx" ON "ScholarRequest"("importBatchId");

-- CreateIndex
CREATE INDEX "SupportActivity_importBatchId_idx" ON "SupportActivity"("importBatchId");

-- AddForeignKey
ALTER TABLE "DataImportBatch" ADD CONSTRAINT "DataImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
