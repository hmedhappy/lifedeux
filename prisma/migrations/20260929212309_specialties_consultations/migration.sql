-- CreateEnum
CREATE TYPE "SlotKind" AS ENUM ('OPERATION', 'CONSULTATION');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'REFUSED', 'EXPIRED', 'PAID', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'IMAGE', 'PRESCRIPTION');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'ISSUED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_DOCTOR';

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_bookingId_fkey";

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "consultationFee" INTEGER,
ADD COLUMN     "consultationMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "consultationPrice" INTEGER,
ADD COLUMN     "licenseNumber" TEXT,
ADD COLUMN     "offersConsultation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" TEXT,
ADD COLUMN     "signatureImageId" TEXT,
ADD COLUMN     "specialtyId" TEXT,
ADD COLUMN     "stampImageId" TEXT;

-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "consultationId" TEXT,
ADD COLUMN     "private" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Operation" ADD COLUMN     "specialtyId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "consultationId" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Slot" ADD COLUMN     "kind" "SlotKind" NOT NULL DEFAULT 'OPERATION';

-- CreateTable
CREATE TABLE "Specialty" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "consultationPrice" INTEGER NOT NULL DEFAULT 5000,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dci" TEXT,
    "form" TEXT,
    "strength" TEXT,
    "searchText" TEXT NOT NULL,
    "specialtyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "refusalReason" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "doctorFee" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "paymentDeadline" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
    "text" TEXT,
    "imageId" TEXT,
    "prescriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "number" TEXT,
    "consultationId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "contentHash" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionItem" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "medicationId" TEXT,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "instructions" TEXT,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Specialty_slug_key" ON "Specialty"("slug");

-- CreateIndex
CREATE INDEX "Medication_searchText_idx" ON "Medication"("searchText");

-- CreateIndex
CREATE UNIQUE INDEX "Medication_name_strength_form_key" ON "Medication"("name", "strength", "form");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_reference_key" ON "Consultation"("reference");

-- CreateIndex
CREATE INDEX "Consultation_status_idx" ON "Consultation"("status");

-- CreateIndex
CREATE INDEX "Consultation_patientId_idx" ON "Consultation"("patientId");

-- CreateIndex
CREATE INDEX "Consultation_doctorId_idx" ON "Consultation"("doctorId");

-- CreateIndex
CREATE INDEX "Message_consultationId_createdAt_idx" ON "Message"("consultationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_number_key" ON "Prescription"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_referralCode_key" ON "Doctor"("referralCode");

-- CreateIndex
CREATE INDEX "Payment_consultationId_idx" ON "Payment"("consultationId");

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

