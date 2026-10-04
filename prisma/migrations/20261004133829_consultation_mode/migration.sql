-- CreateEnum
CREATE TYPE "ConsultationMode" AS ENUM ('ONLINE', 'IN_PERSON');

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "mode" "ConsultationMode" NOT NULL DEFAULT 'ONLINE';
