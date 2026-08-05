-- AlterTable
ALTER TABLE "RiskAssessment" ADD COLUMN     "assessmentComplete" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "missingInputs" TEXT[] DEFAULT ARRAY[]::TEXT[];
