/**
 * npm run db:reset-users -- --yes
 *
 * Wipes every account and everything attached to people (bookings, consultations,
 * messages, prescriptions, payments, payouts, slots, doctor profiles, private images)
 * to start production from a clean state. Keeps the reference data: specialties,
 * medications, procedures, accommodations and settings. The admin account is then
 * recreated from ADMIN_EMAIL / ADMIN_PASSWORD.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("This deletes ALL users and their data. Re-run with --yes to confirm:\n  npm run db:reset-users -- --yes");
    process.exit(1);
  }
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 8) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) so the admin can be recreated.");
  }

  // Images still used by kept data (accommodation photos) must survive.
  const stays = await db.accommodation.findMany({ select: { photos: true } });
  const keepImageIds = stays.flatMap((s) => s.photos).filter((p) => p.startsWith("/api/images/")).map((p) => p.slice("/api/images/".length));

  const counts = await db.$transaction(async (tx) => {
    const r = {
      messages: (await tx.message.deleteMany()).count,
      prescriptionItems: (await tx.prescriptionItem.deleteMany()).count,
      prescriptions: (await tx.prescription.deleteMany()).count,
      payments: (await tx.payment.deleteMany()).count,
      accessLogs: (await tx.accessLog.deleteMany()).count,
      trackingEvents: (await tx.trackingEvent.deleteMany()).count,
      companions: (await tx.companion.deleteMany()).count,
      bookings: (await tx.booking.deleteMany()).count,
      consultations: (await tx.consultation.deleteMany()).count,
      payouts: (await tx.doctorPayout.deleteMany()).count,
      slots: (await tx.slot.deleteMany()).count,
      doctorOperations: (await tx.doctorOperation.deleteMany()).count,
      images: (await tx.image.deleteMany({ where: { id: { notIn: keepImageIds } } })).count,
      doctors: 0,
      users: 0,
    };
    // Referrals point from doctor to doctor: clear them before deleting.
    await tx.doctor.updateMany({ data: { referredById: null } });
    r.doctors = (await tx.doctor.deleteMany()).count;
    r.users = (await tx.user.deleteMany()).count;
    return r;
  });

  await db.user.create({
    data: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "ADMIN",
      firstName: "Admin",
      lastName: "LifeDeux",
      consentAt: new Date(),
    },
  });

  const kept = {
    specialties: await db.specialty.count(),
    medications: await db.medication.count(),
    operations: await db.operation.count(),
    accommodations: await db.accommodation.count(),
  };
  console.log("Deleted:", counts);
  console.log("Kept:", kept);
  console.log(`Admin recreated: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
