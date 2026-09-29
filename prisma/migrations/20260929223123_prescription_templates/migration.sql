-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "prescriptionTemplate" TEXT;

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "templateRef" TEXT;

-- CreateTable
CREATE TABLE "PrescriptionTemplate" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layout" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0f8f7e',
    "backgroundImageId" TEXT,
    "marginTop" INTEGER NOT NULL DEFAULT 45,
    "marginBottom" INTEGER NOT NULL DEFAULT 30,
    "marginLeft" INTEGER NOT NULL DEFAULT 18,
    "marginRight" INTEGER NOT NULL DEFAULT 18,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrescriptionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrescriptionTemplate_doctorId_idx" ON "PrescriptionTemplate"("doctorId");

-- AddForeignKey
ALTER TABLE "PrescriptionTemplate" ADD CONSTRAINT "PrescriptionTemplate_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

