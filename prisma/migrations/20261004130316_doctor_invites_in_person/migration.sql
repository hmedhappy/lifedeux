-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "clinicLat" DOUBLE PRECISION,
ADD COLUMN     "clinicLng" DOUBLE PRECISION,
ADD COLUMN     "inPersonPrice" INTEGER,
ADD COLUMN     "offersInPerson" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DoctorInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorInvite_token_key" ON "DoctorInvite"("token");

-- CreateIndex
CREATE INDEX "DoctorInvite_email_idx" ON "DoctorInvite"("email");
