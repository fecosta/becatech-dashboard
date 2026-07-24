/*
  Warnings:

  - You are about to drop the column `university` on the `Scholar` table. All the data in the column will be lost.
  - Added the required column `universityId` to the `Scholar` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UniversityType" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "OperatorTrack" AS ENUM ('EARLY_SUPPORT', 'GROWTH_DEVELOPMENT');

-- DropIndex
DROP INDEX "Scholar_university_idx";

-- AlterTable
ALTER TABLE "Scholar" DROP COLUMN "university",
ADD COLUMN     "operatorId" TEXT,
ADD COLUMN     "universityId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "city" TEXT NOT NULL,
    "type" "UniversityType" NOT NULL,
    "semesterStartDate" TIMESTAMP(3),
    "semesterEndDate" TIMESTAMP(3),
    "examWindowStart" TIMESTAMP(3),
    "examWindowEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "track" "OperatorTrack" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "University_name_key" ON "University"("name");

-- CreateIndex
CREATE INDEX "University_country_idx" ON "University"("country");

-- CreateIndex
CREATE UNIQUE INDEX "Operator_name_key" ON "Operator"("name");

-- CreateIndex
CREATE INDEX "Operator_track_idx" ON "Operator"("track");

-- CreateIndex
CREATE INDEX "Operator_country_idx" ON "Operator"("country");

-- CreateIndex
CREATE INDEX "Scholar_universityId_idx" ON "Scholar"("universityId");

-- CreateIndex
CREATE INDEX "Scholar_operatorId_idx" ON "Scholar"("operatorId");

-- AddForeignKey
ALTER TABLE "Scholar" ADD CONSTRAINT "Scholar_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scholar" ADD CONSTRAINT "Scholar_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
