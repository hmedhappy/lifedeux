"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fail, type ActionState } from "@/lib/action-state";
import { CONSULT_MIN_LEAD_HOURS, CONSULT_PAYMENT_CUTOFF_MINUTES } from "@/lib/consultation-rules";
import { formatDateTime } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";
import { sendTemplate } from "@/lib/mail";
import { getProvider } from "@/lib/payments";
import { consultationOffer } from "@/lib/queries";
import { isDoctorRole } from "@/lib/roles";
import { appUrl, getSettings } from "@/lib/settings";
import { bookingReference } from "@/lib/tokens";

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
  redirect(`/${locale}/account/consultations/${consultation.id}?requested=1`);
}

export async function confirmConsultationAction(localeRaw: string, id: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) redirect(`/${locale}/login`);
  const c = await db.consultation.findFirst({
    where: { id, doctorId: me.doctor.id, status: "REQUESTED" },
    include: { slot: true, patient: true },
  });
  if (!c) redirect(`/${locale}/doctor`);
  const settings = await getSettings();
  const now = Date.now();
  const cutoff = c.slot.startsAt.getTime() - CONSULT_PAYMENT_CUTOFF_MINUTES * 60_000;
  const deadline = new Date(Math.min(now + settings.paymentDeadlineHours * 3_600_000, cutoff));
  if (deadline.getTime() <= now) redirect(`/${locale}/doctor?done=tooLate&ref=${c.reference}`);

  await db.consultation.updateMany({
    where: { id: c.id, status: "REQUESTED" },
    data: { status: "CONFIRMED", confirmedAt: new Date(), paymentDeadline: deadline },
  });
  const patientLocale = toLocale(c.patient.locale);
  await sendTemplate(
    c.patient,
    "consultConfirmed",
    { reference: c.reference, date: formatDateTime(c.slot.startsAt, patientLocale), deadline: formatDateTime(deadline, patientLocale) },
    `/account/consultations/${c.id}`,
  );
  revalidatePath(`/${locale}/doctor`);
  redirect(`/${locale}/doctor?done=confirmed&ref=${c.reference}`);
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
  const c = await db.consultation.findFirst({
    where: { id, doctorId: me.doctor.id, status: { in: ["REQUESTED", "CONFIRMED"] }, paidAt: null },
    include: { patient: true },
  });
  if (!c) return fail("errors.invalid");
  await db.$transaction([
    db.consultation.update({ where: { id: c.id }, data: { status: "REFUSED", refusalReason: reason } }),
    db.slot.updateMany({ where: { id: c.slotId, status: "HELD" }, data: { status: "FREE" } }),
    db.payment.updateMany({ where: { consultationId: c.id, status: "PENDING" }, data: { status: "FAILED" } }),
  ]);
  await sendTemplate(c.patient, "refused", { reference: c.reference, reason }, `/account/consultations/${c.id}`);
  revalidatePath(`/${locale}/doctor`);
  redirect(`/${locale}/doctor?done=refused&ref=${c.reference}`);
}

export async function cancelConsultationAction(localeRaw: string, id: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) redirect(`/${locale}/login`);
  await db.$transaction(async (tx) => {
    const c = await tx.consultation.findFirst({ where: { id, patientId: patient.id, status: { in: ["REQUESTED", "CONFIRMED"] } } });
    if (!c) return;
    await tx.consultation.update({ where: { id: c.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await tx.slot.updateMany({ where: { id: c.slotId, status: "HELD" }, data: { status: "FREE" } });
    await tx.payment.updateMany({ where: { consultationId: c.id, status: "PENDING" }, data: { status: "FAILED" } });
  });
  redirect(`/${locale}/account/consultations/${id}`);
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
  if (!c || c.status !== "CONFIRMED") return fail("errors.invalid");
  if (c.paymentDeadline && c.paymentDeadline < new Date()) return fail("errors.deadlinePassed");

  const payment = await db.payment.create({
    data: { consultationId: c.id, provider: provider.id, amount: c.price, currency: c.currency },
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
  await db.consultation.updateMany({
    where: { id, doctorId: me.doctor.id, status: "PAID" },
    data: { status: "COMPLETED", endedAt: new Date() },
  });
  revalidatePath(`/${locale}/doctor/consultations/${id}`);
  redirect(`/${locale}/doctor/consultations/${id}`);
}
