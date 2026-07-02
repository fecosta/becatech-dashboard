-- CreateEnum
CREATE TYPE "Country" AS ENUM ('COLOMBIA', 'PERU');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'GRADUATED', 'PAUSED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('SIN_RIESGO', 'RIESGO_BAJO', 'RIESGO_MEDIO', 'RIESGO_ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "RiskChangeLabel" AS ENUM ('STRONG_IMPROVEMENT', 'IMPROVED', 'STABLE', 'WORSENED', 'SIGNIFICANT_DETERIORATION');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('ACADEMIC', 'PSYCHOSOCIAL', 'PARTICIPATION', 'PERMANENCE', 'COMBINED', 'NONE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'REVIEWED', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'PENDING');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('INDIVIDUAL_TUTORING', 'GROUP_TUTORING', 'INDIVIDUAL_MENTORING', 'GROUP_MENTORING', 'WORKSHOP', 'PSYCHOSOCIAL_SUPPORT', 'INDIVIDUAL_SESSION', 'OTHER');

-- CreateEnum
CREATE TYPE "AcademicProgressStatus" AS ENUM ('ON_TRACK', 'SLIGHTLY_BEHIND', 'BEHIND', 'CRITICAL_DELAY');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('EXECUTIVE', 'PROGRAM_MANAGER', 'MENTOR', 'ANALYST_ADMIN', 'FINANCE', 'SELECTION_TEAM');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "SelectionStage" AS ENUM ('APPLICATION_RECEIVED', 'ELIGIBILITY_REVIEW', 'ASSESSMENT', 'INTERVIEW', 'FINAL_COMMITTEE', 'SELECTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Scholar" (
    "scholarId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "cohort" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "academicProgram" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "ethnicGroup" TEXT,
    "departmentOrigin" TEXT,
    "municipalityOrigin" TEXT,
    "currentDepartment" TEXT,
    "currentMunicipality" TEXT,
    "programStatus" "ProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentSemester" INTEGER,
    "currentMentor" TEXT,
    "startDate" TIMESTAMP(3),
    "expectedEndDate" TIMESTAMP(3),
    "driveFolderUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scholar_pkey" PRIMARY KEY ("scholarId")
);

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL,
    "scholarId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "enrollmentStatus" TEXT,
    "creditsEnrolled" INTEGER,
    "creditsCompleted" INTEGER,
    "accumulatedCredits" INTEGER,
    "totalProgramCredits" INTEGER,
    "progressPercentage" DOUBLE PRECISION,
    "gpa" DOUBLE PRECISION,
    "accumulatedGpa" DOUBLE PRECISION,
    "failedSubjectsCount" INTEGER,
    "failedSubjectsDetail" TEXT,
    "delayedSubjects" TEXT,
    "levelingAlternative" TEXT,
    "isLeveling" BOOLEAN NOT NULL DEFAULT false,
    "maxDeadline" TIMESTAMP(3),
    "receivedSupport" BOOLEAN NOT NULL DEFAULT false,
    "expectedProgressStatus" "AcademicProgressStatus",
    "academicStatus" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyCheckin" (
    "id" TEXT NOT NULL,
    "scholarId" TEXT NOT NULL,
    "country" "Country",
    "cohort" TEXT,
    "university" TEXT,
    "reportingMonth" TEXT NOT NULL,
    "submissionDate" TIMESTAMP(3),
    "scholarName" TEXT,
    "academicSelfReport" TEXT,
    "academicLevel" TEXT,
    "emotionalSelfReport" TEXT,
    "psychosocialLevel" TEXT,
    "externalFactorReport" TEXT,
    "externalFactorLevel" TEXT,
    "finalStatus" TEXT,
    "submissionId" TEXT NOT NULL,
    "sourceForm" TEXT,
    "rawSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorReport" (
    "id" TEXT NOT NULL,
    "scholarId" TEXT NOT NULL,
    "scholarName" TEXT,
    "mentorName" TEXT,
    "country" "Country",
    "cohort" TEXT,
    "university" TEXT,
    "reportingMonth" TEXT,
    "registrationDate" TIMESTAMP(3),
    "sessionDate" TIMESTAMP(3),
    "sessionType" TEXT,
    "sessionSummary" TEXT,
    "modality" TEXT,
    "permanenceRisk" TEXT,
    "academicStatus" TEXT,
    "academicAlertType" TEXT,
    "approvedCoursesCount" INTEGER,
    "atRiskCoursesCount" INTEGER,
    "difficultSubjects" TEXT,
    "psychosocialStatus" TEXT,
    "psychosocialAlertType" TEXT,
    "accompanimentPlan" TEXT,
    "estimatedSupportTime" TEXT,
    "individualTutoring" INTEGER NOT NULL DEFAULT 0,
    "groupTutoring" INTEGER NOT NULL DEFAULT 0,
    "individualMentoring" INTEGER NOT NULL DEFAULT 0,
    "groupMentoring" INTEGER NOT NULL DEFAULT 0,
    "workshops" INTEGER NOT NULL DEFAULT 0,
    "highlights" TEXT,
    "academicProgressNotes" TEXT,
    "nextSteps" TEXT,
    "submissionId" TEXT NOT NULL,
    "rawSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportActivity" (
    "id" TEXT NOT NULL,
    "scholarId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "country" "Country",
    "cohort" TEXT,
    "university" TEXT,
    "activityType" "ActivityType" NOT NULL,
    "activityCount" INTEGER NOT NULL DEFAULT 0,
    "attendanceStatus" TEXT,
    "participationRate" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScholarRequest" (
    "id" TEXT NOT NULL,
    "scholarId" TEXT NOT NULL,
    "submissionDate" TIMESTAMP(3),
    "country" "Country",
    "cohort" TEXT,
    "university" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "requestType" TEXT NOT NULL,
    "requestDescription" TEXT,
    "exchangeUniversitySemester" TEXT,
    "homologationSubjects" TEXT,
    "tuitionLivingCosts" TEXT,
    "certificateReason" TEXT,
    "difficultSubject" TEXT,
    "context" TEXT,
    "attachmentUrl" TEXT,
    "submissionId" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "responseChannel" TEXT,
    "observations" TEXT,
    "owner" TEXT,
    "resolvedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScholarRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "scholarId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "country" "Country",
    "cohort" TEXT,
    "university" TEXT,
    "academicRiskLevel" "RiskLevel" NOT NULL,
    "academicRiskValue" INTEGER NOT NULL,
    "psychosocialRiskLevel" "RiskLevel" NOT NULL,
    "psychosocialRiskValue" INTEGER NOT NULL,
    "participationRiskLevel" "RiskLevel" NOT NULL,
    "participationRiskValue" INTEGER NOT NULL,
    "globalRiskLevel" "RiskLevel" NOT NULL,
    "globalRiskValue" INTEGER NOT NULL,
    "previousGlobalRiskValue" INTEGER,
    "riskChange" INTEGER,
    "riskChangeLabel" "RiskChangeLabel",
    "alertType" "AlertType" NOT NULL DEFAULT 'NONE',
    "riskReason" TEXT,
    "recommendedAction" TEXT,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialInput" (
    "id" TEXT NOT NULL,
    "scholarId" TEXT,
    "period" TEXT NOT NULL,
    "country" "Country",
    "cohort" TEXT,
    "university" TEXT,
    "costCategory" TEXT NOT NULL,
    "costAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "fundingSource" TEXT,
    "isDirectCost" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectionCandidate" (
    "candidateId" TEXT NOT NULL,
    "scholarId" TEXT,
    "fullName" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "cohort" TEXT,
    "university" TEXT,
    "applicationDate" TIMESTAMP(3),
    "currentStage" "SelectionStage" NOT NULL DEFAULT 'APPLICATION_RECEIVED',
    "stageStatus" TEXT,
    "selectionScore" DOUBLE PRECISION,
    "evaluationNotes" TEXT,
    "decisionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelectionCandidate_pkey" PRIMARY KEY ("candidateId")
);

-- CreateTable
CREATE TABLE "SelectionStageHistory" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "stageName" "SelectionStage" NOT NULL,
    "stageStatus" TEXT,
    "stageStartDate" TIMESTAMP(3),
    "stageEndDate" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelectionStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawJotformSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formName" TEXT,
    "submissionId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "payloadJson" JSONB NOT NULL,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawJotformSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityIssue" (
    "id" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "sourceName" TEXT,
    "recordId" TEXT,
    "scholarId" TEXT,
    "issueDescription" TEXT NOT NULL,
    "severity" TEXT,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataQualityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlValue" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserScholarAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scholarId" TEXT NOT NULL,
    "accessType" TEXT NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserScholarAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Scholar_country_idx" ON "Scholar"("country");

-- CreateIndex
CREATE INDEX "Scholar_cohort_idx" ON "Scholar"("cohort");

-- CreateIndex
CREATE INDEX "Scholar_university_idx" ON "Scholar"("university");

-- CreateIndex
CREATE INDEX "Scholar_programStatus_idx" ON "Scholar"("programStatus");

-- CreateIndex
CREATE INDEX "AcademicTerm_term_idx" ON "AcademicTerm"("term");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_scholarId_term_key" ON "AcademicTerm"("scholarId", "term");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyCheckin_submissionId_key" ON "MonthlyCheckin"("submissionId");

-- CreateIndex
CREATE INDEX "MonthlyCheckin_scholarId_reportingMonth_idx" ON "MonthlyCheckin"("scholarId", "reportingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "MentorReport_submissionId_key" ON "MentorReport"("submissionId");

-- CreateIndex
CREATE INDEX "MentorReport_scholarId_reportingMonth_idx" ON "MentorReport"("scholarId", "reportingMonth");

-- CreateIndex
CREATE INDEX "SupportActivity_period_idx" ON "SupportActivity"("period");

-- CreateIndex
CREATE INDEX "SupportActivity_activityType_idx" ON "SupportActivity"("activityType");

-- CreateIndex
CREATE UNIQUE INDEX "SupportActivity_scholarId_period_activityType_source_key" ON "SupportActivity"("scholarId", "period", "activityType", "source");

-- CreateIndex
CREATE UNIQUE INDEX "ScholarRequest_submissionId_key" ON "ScholarRequest"("submissionId");

-- CreateIndex
CREATE INDEX "ScholarRequest_scholarId_idx" ON "ScholarRequest"("scholarId");

-- CreateIndex
CREATE INDEX "ScholarRequest_status_idx" ON "ScholarRequest"("status");

-- CreateIndex
CREATE INDEX "RiskAssessment_globalRiskLevel_idx" ON "RiskAssessment"("globalRiskLevel");

-- CreateIndex
CREATE INDEX "RiskAssessment_period_idx" ON "RiskAssessment"("period");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_scholarId_period_key" ON "RiskAssessment"("scholarId", "period");

-- CreateIndex
CREATE INDEX "FinancialInput_scholarId_idx" ON "FinancialInput"("scholarId");

-- CreateIndex
CREATE INDEX "FinancialInput_costCategory_idx" ON "FinancialInput"("costCategory");

-- CreateIndex
CREATE INDEX "FinancialInput_period_idx" ON "FinancialInput"("period");

-- CreateIndex
CREATE UNIQUE INDEX "SelectionCandidate_scholarId_key" ON "SelectionCandidate"("scholarId");

-- CreateIndex
CREATE INDEX "SelectionCandidate_currentStage_idx" ON "SelectionCandidate"("currentStage");

-- CreateIndex
CREATE INDEX "SelectionStageHistory_candidateId_idx" ON "SelectionStageHistory"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "RawJotformSubmission_submissionId_key" ON "RawJotformSubmission"("submissionId");

-- CreateIndex
CREATE INDEX "RawJotformSubmission_processingStatus_idx" ON "RawJotformSubmission"("processingStatus");

-- CreateIndex
CREATE INDEX "RawJotformSubmission_formId_idx" ON "RawJotformSubmission"("formId");

-- CreateIndex
CREATE INDEX "DataQualityIssue_issueType_idx" ON "DataQualityIssue"("issueType");

-- CreateIndex
CREATE INDEX "DataQualityIssue_status_idx" ON "DataQualityIssue"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ControlValue_category_value_key" ON "ControlValue"("category", "value");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex
CREATE INDEX "UserScholarAccess_scholarId_idx" ON "UserScholarAccess"("scholarId");

-- CreateIndex
CREATE UNIQUE INDEX "UserScholarAccess_userId_scholarId_accessType_key" ON "UserScholarAccess"("userId", "scholarId", "accessType");

-- AddForeignKey
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_scholarId_fkey" FOREIGN KEY ("scholarId") REFERENCES "Scholar"("scholarId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyCheckin" ADD CONSTRAINT "MonthlyCheckin_scholarId_fkey" FOREIGN KEY ("scholarId") REFERENCES "Scholar"("scholarId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyCheckin" ADD CONSTRAINT "MonthlyCheckin_rawSubmissionId_fkey" FOREIGN KEY ("rawSubmissionId") REFERENCES "RawJotformSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorReport" ADD CONSTRAINT "MentorReport_scholarId_fkey" FOREIGN KEY ("scholarId") REFERENCES "Scholar"("scholarId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorReport" ADD CONSTRAINT "MentorReport_rawSubmissionId_fkey" FOREIGN KEY ("rawSubmissionId") REFERENCES "RawJotformSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportActivity" ADD CONSTRAINT "SupportActivity_scholarId_fkey" FOREIGN KEY ("scholarId") REFERENCES "Scholar"("scholarId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScholarRequest" ADD CONSTRAINT "ScholarRequest_scholarId_fkey" FOREIGN KEY ("scholarId") REFERENCES "Scholar"("scholarId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_scholarId_fkey" FOREIGN KEY ("scholarId") REFERENCES "Scholar"("scholarId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInput" ADD CONSTRAINT "FinancialInput_scholarId_fkey" FOREIGN KEY ("scholarId") REFERENCES "Scholar"("scholarId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionCandidate" ADD CONSTRAINT "SelectionCandidate_scholarId_fkey" FOREIGN KEY ("scholarId") REFERENCES "Scholar"("scholarId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionStageHistory" ADD CONSTRAINT "SelectionStageHistory_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "SelectionCandidate"("candidateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScholarAccess" ADD CONSTRAINT "UserScholarAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScholarAccess" ADD CONSTRAINT "UserScholarAccess_scholarId_fkey" FOREIGN KEY ("scholarId") REFERENCES "Scholar"("scholarId") ON DELETE CASCADE ON UPDATE CASCADE;
