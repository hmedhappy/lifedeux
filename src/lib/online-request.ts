import "server-only";
import { db } from "./db";
import { acceptConsultation } from "./consultation-flow";
import { CONSULT_MIN_LEAD_HOURS } from "./consultation-rules";
import { formatDateTime } from "./format";
import { toLocale } from "./i18n";
import { IMAGE_PATH_PREFIX, saveUploadedImages } from "./images";
import { sendTemplate } from "./mail";
import { providersFor } from "./payments";
import { consultationOffer } from "./queries";
import { getSettings } from "./settings";
import { bookingReference, randomToken } from "./tokens";
import { EMAIL_CONFIRM_MINUTES } from "./in-person";

/**
 * Holds the slot and creates an online consultation request. Without a signed-in patient
 * it waits (UNVERIFIED) for the link sent by email. Photos go straight into the private chat.
 */
export async function createOnlineRequest(input: { patientId: string; doctorId: string; slotId: string; reason: string | null; formData: FormData; unverified: boolean }) {
  const doctor = await db.doctor.findFirst({ where: { id: input.doctorId, active: true, user: { active: true } }, include: { specialty_: true } });
  const offer = doctor ? consultationOffer(doctor) : null;
  if (!doctor || !offer) return { error: "errors.invalid" as const };
  const settings = await getSettings();
  const earliest = new Date(Date.now() + CONSULT_MIN_LEAD_HOURS * 3_600_000);
  const consultation = await db.$transaction(async (tx) => {
    const held = await tx.slot.updateMany({
      where: { id: input.slotId, doctorId: doctor.id, kind: "CONSULTATION", status: "FREE", startsAt: { gt: earliest } },
      data: { status: "HELD" },
    });
    if (held.count === 0) return null;
    return tx.consultation.create({
      data: {
        reference: bookingReference().replace("LD-", "LC-"),
        status: input.unverified ? "UNVERIFIED" : "REQUESTED",
        emailConfirmToken: input.unverified ? randomToken(24) : null,
        emailConfirmExpiresAt: input.unverified ? new Date(Date.now() + EMAIL_CONFIRM_MINUTES * 60_000) : null,
        patientId: input.patientId,
        doctorId: doctor.id,
        slotId: input.slotId,
        reason: input.reason,
        durationMinutes: doctor.consultationMinutes,
        price: offer.price,
        doctorFee: offer.fee,
        currency: settings.currency,
      },
      include: { slot: true },
    });
  });
  if (!consultation) return { error: "errors.slotTaken" as const };

  const photos = await saveUploadedImages(input.formData, "photos", 3, { private: true, consultationId: consultation.id });
  if (!("error" in photos) && photos.paths.length) {
    await db.message.createMany({
      data: photos.paths.map((path, i) => ({
        consultationId: consultation.id,
        senderId: input.patientId,
        kind: "IMAGE" as const,
        imageId: path.slice(IMAGE_PATH_PREFIX.length),
        createdAt: new Date(Date.now() + i),
      })),
    });
  }
  return { consultation };
}

/** The request reaches the doctor (and the patient gets the receipt). */
export async function submitOnlineRequest(consultationId: string): Promise<void> {
  const c = await db.consultation.findUniqueOrThrow({
    where: { id: consultationId },
    include: { slot: true, patient: true, doctor: { include: { user: true } } },
  });
  await Promise.all([
    sendTemplate(
      c.patient,
      "requestReceived",
      { reference: c.reference, date: formatDateTime(c.slot.startsAt, toLocale(c.patient.locale)) },
      `/account/consultations/${c.id}`,
    ),
    sendTemplate(c.doctor.user, "newRequest", { reference: c.reference, date: formatDateTime(c.slot.startsAt, toLocale(c.doctor.user.locale)) }, "/doctor"),
  ]);
  // Instant booking with no way to hold a card: accept now, the patient pays right after.
  if (c.doctor.instantBooking && providersFor(c.patient.country, { hold: true }).length === 0) {
    await acceptConsultation(c.id);
  }
}
