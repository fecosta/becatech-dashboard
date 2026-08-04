-- AlterTable
ALTER TABLE "Scholar" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "email1" TEXT,
ADD COLUMN     "email2" TEXT,
ADD COLUMN     "estimatedGraduationYear" INTEGER,
ADD COLUMN     "fatherEducationLevel" TEXT,
ADD COLUMN     "highSchoolGraduationYear" INTEGER,
ADD COLUMN     "mobilePhone" TEXT,
ADD COLUMN     "motherEducationLevel" TEXT,
ADD COLUMN     "programDurationYears" INTEGER,
ADD COLUMN     "socioeconomicLevel" TEXT;
