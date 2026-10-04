-- AlterEnum
ALTER TYPE "ConsultationStatus" ADD VALUE 'UNVERIFIED';

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "emailConfirmExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailConfirmToken" TEXT;

-- CreateTable
CREATE TABLE "FavoriteDoctor" (
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteDoctor_pkey" PRIMARY KEY ("patientId","doctorId")
);

-- CreateIndex
CREATE INDEX "FavoriteDoctor_doctorId_idx" ON "FavoriteDoctor"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_emailConfirmToken_key" ON "Consultation"("emailConfirmToken");

-- AddForeignKey
ALTER TABLE "FavoriteDoctor" ADD CONSTRAINT "FavoriteDoctor_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteDoctor" ADD CONSTRAINT "FavoriteDoctor_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

