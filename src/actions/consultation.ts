"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { CONSULT_MIN_LEAD_HOURS, IN_PERSON_MIN_LEAD_MINUTES, canMarkNoShow } from "@/lib/consultation-rules";
import {
  acceptConsultation,
  answerReschedule,
  cancelConsultationByPatient,
  refuseConsultation,
  requestReschedule,
  submitReview,
  withdrawReschedule,
} from "@/lib/consultation-flow";
import { formatDateTime } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";
import { sendTemplate } from "@/lib/mail";
import { getProvider, providersFor } from "@/lib/payments";
import { consultationOffer, inPersonOffer } from "@/lib/queries";
import { isDoctorRole } from "@/lib/roles";
import { appUrl, getSettings } from "@/lib/settings";
import { bookingReference } from "@/lib/tokens";
import { IMAGE_PATH_PREFIX, saveUploadedImages } from "@/lib/images";

async function currentPatient() {
  const user = await getCurrentUser();
  return user && user.role === "PATIENT" ? user : null;
}

async function currentDoctor() {
  const user = await getCurrentUser();
  if (!user || !isDoctorRole(user.role)) return null;
  const doctor = await db.doctor.findUnique({ where: { userId: user.id } });
  return doctor ? { user, doctor } : null;
}

export async function requestConsultationAction(
  localeRaw: string,
  doctorId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) return fail("errors.loginRequired");
  const slotId = String(formData.get("slotId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000) || null;
  if (!slotId) return fail("errors.chooseSlot");
  if (formData.get("consent") !== "on") return fail("errors.consentRequired");

  const doctor = await db.doctor.findFirst({
    where: { id: doctorId, active: true, user: { active: true } },
    include: { user: true, specialty_: true },
  });
  const offer = doctor ? consultationOffer(doctor) : null;
  if (!doctor || !offer) return fail("errors.invalid");

  const settings = await getSettings();
  const earliest = new Date(Date.now() + CONSULT_MIN_LEAD_HOURS * 3_600_000);
  const consultation = await db.$transaction(async (tx) => {
    const held = await tx.slot.updateMany({
      where: { id: slotId, doctorId, kind: "CONSULTATION", status: "FREE", startsAt: { gt: earliest } },
      data: { status: "HELD" },
    });
    if (held.count === 0) return null;
    return tx.consultation.create({
      data: {
        reference: bookingReference().replace("LD-", "LC-"),
        patientId: patient.id,
        doctorId,
        slotId,
        reason,
        durationMinutes: doctor.consultationMinutes,
        price: offer.price,
        doctorFee: offer.fee,
        currency: settings.currency,
      },
      include: { slot: true },
    });
  });
  if (!consultation) return fail("errors.slotTaken");

  // Photos sent with the request go straight into the (private) conversation.
  const photos = await saveUploadedImages(formData, "photos", 3, { private: true, consultationId: consultation.id });
  if (!("error" in photos) && photos.paths.length) {
    await db.message.createMany({
      data: photos.paths.map((path, i) => ({
        consultationId: consultation.id,
        senderId: patient.id,
        kind: "IMAGE" as const,
        imageId: path.slice(IMAGE_PATH_PREFIX.length),
        createdAt: new Date(Date.now() + i),
      })),
    });
  }

  await Promise.all([
    sendTemplate(
      patient,
      "requestReceived",
      { reference: consultation.reference, date: formatDateTime(consultation.slot.startsAt, locale) },
      `/account/consultations/${consultation.id}`,
    ),
    sendTemplate(
      doctor.user,
      "newRequest",
      { reference: consultation.reference, date: formatDateTime(consultation.slot.startsAt, toLocale(doctor.user.locale)) },
      "/doctor",
    ),
  ]);
  // Instant booking with no way to hold a card: accept now, the patient pays right after.
  if (doctor.instantBooking && providersFor(patient.country, { hold: true }).length === 0) {
    await acceptConsultation(consultation.id);
  }
  redirect(`/${locale}/account/consultations/${consultation.id}?requested=1`);
}

/**
 * Appointment at the practice: no payment, no chat. Confirmed at once when the doctor
 * accepts requests automatically, otherwise the doctor confirms it.
 */
export async function requestInPersonAction(localeRaw: string, doctorId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) return fail("errors.loginRequired");
  const slotId = String(formData.get("slotId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000) || null;
  if (!slotId) return fail("errors.chooseSlot");

  const doctor = await db.doctor.findFirst({ where: { id: doctorId, active: true, user: { active: true } }, include: { user: true } });
  const offer = doctor ? inPersonOffer(doctor) : null;
  if (!doctor || !offer) return fail("errors.invalid");

  const settings = await getSettings();
  const earliest = new Date(Date.now() + IN_PERSON_MIN_LEAD_MINUTES * 60_000);
  const consultation = await db.$transaction(async (tx) => {
    const held = await tx.slot.updateMany({
      where: { id: slotId, doctorId, kind: "CONSULTATION", status: "FREE", startsAt: { gt: earliest } },
      data: { status: "HELD" },
    });
    if (held.count === 0) return null;
    return tx.consultation.create({
      data: {
        reference: bookingReference().replace("LD-", "LC-"),
        mode: "IN_PERSON",
        patientId: patient.id,
        doctorId,
        slotId,
        reason,
        durationMinutes: doctor.consultationMinutes,
        price: offer.price,
        // Paid at the practice: Medelys owes the doctor nothing for it.
        doctorFee: 0,
        currency: settings.currency,
      },
      include: { slot: true },
    });
  });
  if (!consultation) return fail("errors.slotTaken");

  const doctorDate = formatDateTime(consultation.slot.startsAt, toLocale(doctor.user.locale));
  await sendTemplate(doctor.user, "newInPerson", { reference: consultation.reference, date: doctorDate, patient: `${patient.firstName} ${patient.lastName}` }, `/doctor/consultations/${consultation.id}`);
  if (doctor.instantBooking) {
    await acceptConsultation(consultation.id);
  } else {
    await sendTemplate(
      patient,
      "inPersonRequested",
      { reference: consultation.reference, date: formatDateTime(consultation.slot.startsAt, locale), doctor: `Dr ${doctor.user.lastName}` },
      `/account/consultations/${consultation.id}`,
    );
  }
  redirect(`/${locale}/account/consultations/${consultation.id}?requested=1`);
}

/** At the practice, the doctor records whether the patient came. */
export async function closeInPersonAction(localeRaw: string, id: string, outcome: "COMPLETED" | "NO_SHOW"): Promise<void> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) redirect(`/${locale}/login`);
  await db.consultation.updateMany({
    where: { id, doctorId: me.doctor.id, mode: "IN_PERSON", status: "CONFIRMED", slot: { startsAt: { lt: new Date() } } },
    data: { status: outcome, endedAt: new Date() },
  });
  revalidatePath(`/${locale}/doctor`, "layout");
  redirect(`/${locale}/doctor/consultations/${id}`);
}

export async function confirmConsultationAction(localeRaw: string, id: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) redirect(`/${locale}/login`);
  const c = await db.consultation.findFirst({ where: { id, doctorId: me.doctor.id, status: "REQUESTED" } });
  if (!c) redirect(`/${locale}/doctor`);
  const outcome = await acceptConsultation(c.id);
  revalidatePath(`/${locale}/doctor`);
  if (outcome === "tooLate") redirect(`/${locale}/doctor?done=tooLate&ref=${c.reference}`);
  redirect(`/${locale}/doctor?done=${outcome === "paid" ? "accepted" : "confirmed"}&ref=${c.reference}`);
}

export async function refuseConsultationAction(
  localeRaw: string,
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) return fail("errors.forbidden");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!reason) return fail("errors.reasonRequired");
  const c = await db.consultation.findFirst({ where: { id, doctorId: me.doctor.id }, select: { reference: true } });
  if (!c || !(await refuseConsultation(id, me.doctor.id, reason))) return fail("errors.invalid");
  revalidatePath(`/${locale}/doctor`);
  redirect(`/${locale}/doctor?done=refused&ref=${c.reference}`);
}

export async function cancelConsultationAction(localeRaw: string, id: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) redirect(`/${locale}/login`);
  const outcome = await cancelConsultationByPatient(id, patient.id);
  if (outcome === "cancelled") {
    // At the practice the doctor keeps the slot in mind: tell them it is free again.
    const c = await db.consultation.findUnique({ where: { id }, include: { slot: true, doctor: { include: { user: true } } } });
    if (c?.mode === "IN_PERSON") {
      const date = formatDateTime(c.slot.startsAt, toLocale(c.doctor.user.locale));
      await sendTemplate(c.doctor.user, "inPersonCancelled", { reference: c.reference, date, patient: `${patient.firstName} ${patient.lastName}` }, "/doctor/slots");
    }
  }
  redirect(`/${locale}/account/consultations/${id}?cancel=${outcome}`);
}

export async function requestRescheduleAction(localeRaw: string, id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) return fail("errors.loginRequired");
  const slotId = String(formData.get("slotId") ?? "");
  if (!slotId) return fail("errors.chooseSlot");
  const outcome = await requestReschedule(id, patient.id, slotId);
  if (outcome === "slotTaken") return fail("errors.slotTaken");
  if (outcome === "tooLate") return fail("errors.rescheduleTooLate");
  if (outcome !== "requested") return fail("errors.invalid");
  revalidatePath(`/${locale}/account/consultations/${id}`);
  return ok("consult.rescheduleSent");
}

export async function withdrawRescheduleAction(localeRaw: string, id: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) redirect(`/${locale}/login`);
  await withdrawReschedule(id, patient.id);
  revalidatePath(`/${locale}/account/consultations/${id}`);
}

export async function answerRescheduleAction(localeRaw: string, id: string, accept: boolean): Promise<void> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) redirect(`/${locale}/login`);
  await answerReschedule(id, me.doctor.id, accept);
  revalidatePath(`/${locale}/doctor`);
  revalidatePath(`/${locale}/doctor/consultations/${id}`);
}

export async function submitReviewAction(localeRaw: string, id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) return fail("errors.loginRequired");
  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail("errors.ratingRequired");
  const text = String(formData.get("text") ?? "").trim().slice(0, 1000) || null;
  if (!(await submitReview(id, patient.id, rating, text))) return fail("errors.invalid");
  revalidatePath(`/${locale}/account/consultations/${id}`);
  return ok("review.thanks");
}

export async function startConsultationPaymentAction(
  localeRaw: string,
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) return fail("errors.loginRequired");
  const provider = getProvider(String(formData.get("provider") ?? ""));
  if (!provider) return fail("errors.providerUnavailable");
  const c = await db.consultation.findFirst({ where: { id, patientId: patient.id } });
  if (!c || (c.status !== "CONFIRMED" && c.status !== "REQUESTED")) return fail("errors.invalid");
  // Before the doctor answers, the card is only held; it is charged on acceptance.
  const hold = c.status === "REQUESTED";
  if (hold && !provider.supportsHold) return fail("errors.providerUnavailable");
  if (c.paymentDeadline && c.paymentDeadline < new Date()) return fail("errors.deadlinePassed");

  const payment = await db.payment.create({
    data: { consultationId: c.id, provider: provider.id, amount: c.price, currency: c.currency, hold },
  });
  const base = `${appUrl()}/${locale}/account/consultations/${c.id}`;
  let checkoutUrl: string;
  try {
    const session = await provider.createCheckout({
      paymentId: payment.id,
      bookingId: c.id,
      reference: c.reference,
      amount: c.price,
      currency: c.currency,
      description: getT(locale)("payment.description", { reference: c.reference }),
      customer: { email: patient.email, firstName: patient.firstName, lastName: patient.lastName, phone: patient.phone },
      successUrl: `${base}?payment=success`,
      cancelUrl: `${base}?payment=cancelled`,
      webhookUrl: `${appUrl()}/api/webhooks/${provider.id}`,
      locale,
      hold,
    });
    await db.payment.update({ where: { id: payment.id }, data: { providerRef: session.providerRef, checkoutUrl: session.checkoutUrl } });
    checkoutUrl = session.checkoutUrl;
  } catch (error) {
    console.error("[payments] consultation checkout failed", error);
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return fail("errors.paymentFailed");
  }
  redirect(checkoutUrl);
}

/** The doctor closes the chat once the consultation is over; it becomes read-only. */
export async function endConsultationAction(localeRaw: string, id: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) redirect(`/${locale}/login`);
  const res = await db.consultation.updateMany({
    where: { id, doctorId: me.doctor.id, status: "PAID" },
    data: { status: "COMPLETED", endedAt: new Date() },
  });
  if (res.count) await db.message.create({ data: { consultationId: id, senderId: me.user.id, kind: "SYSTEM", text: "ended" } });
  revalidatePath(`/${locale}/doctor/consultations/${id}`);
  redirect(`/${locale}/doctor/consultations/${id}`);
}

/**
 * The patient never came: allowed 15 min after the start if they did not join. The slot
 * was reserved for them, so it is not refunded (same rule as a cancellation within 24 h).
 */
export async function markNoShowAction(localeRaw: string, id: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) redirect(`/${locale}/login`);
  const c = await db.consultation.findFirst({ where: { id, doctorId: me.doctor.id, status: "PAID" }, include: { slot: true } });
  if (c && canMarkNoShow(c)) {
    await db.$transaction([
      db.consultation.update({ where: { id: c.id }, data: { status: "NO_SHOW", endedAt: new Date() } }),
      db.message.create({ data: { consultationId: c.id, senderId: me.user.id, kind: "SYSTEM", text: "noShow" } }),
    ]);
  }
  revalidatePath(`/${locale}/doctor/consultations/${id}`);
  redirect(`/${locale}/doctor/consultations/${id}`);
}

/** Structured orientation: an in-person visit at the doctor's practice, or surgery. */
export async function orientConsultationAction(localeRaw: string, id: string, kind: "CLINIC" | "SURGERY"): Promise<void> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) redirect(`/${locale}/login`);
  const c = await db.consultation.findFirst({ where: { id, doctorId: me.doctor.id, status: { in: ["PAID", "COMPLETED"] } } });
  if (c) {
    await db.$transaction([
      db.consultation.update({ where: { id: c.id }, data: { orientation: kind } }),
      db.message.create({ data: { consultationId: c.id, senderId: me.user.id, kind: "SYSTEM", text: `orientation:${kind}` } }),
    ]);
  }
  revalidatePath(`/${locale}/doctor/consultations/${id}`);
}
