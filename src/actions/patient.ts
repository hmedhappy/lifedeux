"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { isLatinName } from "@/lib/latin";
import { isAccommodationAvailable, markPaymentFailed, markPaymentSucceeded } from "@/lib/bookings";
import { MIN_LEAD_HOURS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";
import { sendTemplate } from "@/lib/mail";
import { getProvider, mockPaymentsEnabled } from "@/lib/payments";
import { computeQuote, computeStay } from "@/lib/pricing";
import { appUrl, getSettings } from "@/lib/settings";
import { bookingReference } from "@/lib/tokens";

async function currentPatient() {
  const user = await getCurrentUser();
  return user && user.role === "PATIENT" ? user : null;
}

export async function requestBookingAction(
  localeRaw: string,
  doctorId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) return fail("errors.loginRequired");

  const slotId = String(formData.get("slotId") ?? "");
  const operationId = String(formData.get("operationId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;
  if (!slotId) return fail("errors.chooseSlot");
  if (formData.get("consent") !== "on") return fail("errors.consentRequired");

  // Surgery needs a way to reach the patient abroad: phone and country, asked only once.
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30) || patient.phone;
  const country = String(formData.get("country") ?? "").trim().slice(0, 80) || patient.country;
  if (!phone || phone.length < 6 || !country) return fail("errors.contactRequired");
  if (phone !== patient.phone || country !== patient.country) {
    await db.user.update({ where: { id: patient.id }, data: { phone, country } });
  }

  const offer = await db.doctorOperation.findUnique({
    where: { doctorId_operationId: { doctorId, operationId } },
    include: { operation: true, doctor: { include: { user: true } } },
  });
  if (!offer || !offer.operation.active || !offer.doctor.active || !offer.doctor.user.active) {
    return fail("errors.invalid");
  }

  const settings = await getSettings();
  const earliest = new Date(Date.now() + MIN_LEAD_HOURS * 60 * 60 * 1000);

  const booking = await db.$transaction(async (tx) => {
    const held = await tx.slot.updateMany({
      where: { id: slotId, doctorId, status: "FREE", startsAt: { gt: earliest } },
      data: { status: "HELD" },
    });
    if (held.count === 0) return null;
    return tx.booking.create({
      data: {
        reference: bookingReference(),
        patientId: patient.id,
        doctorId,
        operationId,
        slotId,
        patientNote: note,
        recoveryNights: offer.operation.defaultRecoveryNights,
        operationPrice: offer.price,
        totalAmount: offer.price,
        doctorFee: offer.doctorFee,
        currency: settings.currency,
      },
      include: { slot: true },
    });
  });
  if (!booking) return fail("errors.slotTaken");

  const date = formatDateTime(booking.slot.startsAt, locale);
  await Promise.all([
    sendTemplate(patient, "requestReceived", { reference: booking.reference, date }, `/account/bookings/${booking.id}`),
    sendTemplate(
      offer.doctor.user,
      "newRequest",
      { reference: booking.reference, date: formatDateTime(booking.slot.startsAt, toLocale(offer.doctor.user.locale)) },
      "/doctor",
    ),
  ]);
  redirect(`/${locale}/account/bookings/${booking.id}?requested=1`);
}

const optionsSchema = z.object({
  transport: z.string().optional(),
  accommodationId: z.string().optional(),
  companionsCount: z.coerce.number().int().min(0).max(10),
});

const companionSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  passportNumber: z.string().trim().min(4).max(30),
});

export async function chooseOptionsAction(
  localeRaw: string,
  bookingId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) return fail("errors.loginRequired");

  const parsed = optionsSchema.safeParse({
    transport: formData.get("transport") ?? undefined,
    accommodationId: formData.get("accommodationId") ?? undefined,
    companionsCount: formData.get("companionsCount") ?? 0,
  });
  if (!parsed.success) return fail("errors.invalid");
  const settings = await getSettings();
  const { companionsCount } = parsed.data;
  if (companionsCount > settings.maxCompanions) return fail("errors.tooManyCompanions", { n: settings.maxCompanions });

  const companions: z.infer<typeof companionSchema>[] = [];
  for (let i = 0; i < companionsCount; i++) {
    const c = companionSchema.safeParse({
      firstName: formData.get(`companion_${i}_firstName`),
      lastName: formData.get(`companion_${i}_lastName`),
      passportNumber: formData.get(`companion_${i}_passport`),
    });
    if (!c.success) return fail("errors.companionDetails", { n: i + 1 });
    companions.push(c.data);
  }

  const booking = await db.booking.findFirst({
    where: { id: bookingId, patientId: patient.id },
    include: { slot: true },
  });
  if (!booking || booking.status !== "CONFIRMED") return fail("errors.invalid");
  if (booking.paymentDeadline && booking.paymentDeadline < new Date()) return fail("errors.deadlinePassed");

  const stay = computeStay({ operationDate: booking.slot.startsAt, recoveryNights: booking.recoveryNights });
  const accommodationId = parsed.data.accommodationId || null;

  const result = await db.$transaction(async (tx) => {
    let accommodation = null;
    if (accommodationId) {
      // Serialize concurrent choices of the same lodging.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accommodationId}))`;
      accommodation = await tx.accommodation.findFirst({ where: { id: accommodationId, active: true } });
      if (!accommodation) return "errors.invalid";
      if (accommodation.capacity < 1 + companionsCount) return "errors.capacity";
      if (!(await isAccommodationAvailable(accommodationId, stay.arrivalDate, stay.departureDate, booking.id, tx))) {
        return "errors.lodgingUnavailable";
      }
    }
    const quote = computeQuote({
      operationPrice: booking.operationPrice,
      withTransport: parsed.data.transport === "on",
      companionsCount,
      transportPricePerPerson: settings.transportPricePerPerson,
      accommodation,
      nights: stay.nights,
    });
    await tx.companion.deleteMany({ where: { bookingId: booking.id } });
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        optionsChosen: true,
        withTransport: quote.withTransport,
        accommodationId,
        companionsCount,
        arrivalDate: stay.arrivalDate,
        departureDate: stay.departureDate,
        nights: stay.nights,
        transportPrice: quote.transportPrice,
        accommodationPrice: quote.accommodationPrice,
        totalAmount: quote.totalAmount,
        companions: { create: companions },
      },
    });
    // The amount may have changed: older checkouts must not be reused.
    await tx.payment.updateMany({ where: { bookingId: booking.id, status: "PENDING" }, data: { status: "FAILED" } });
    return null;
  });
  if (result) return fail(result);

  revalidatePath(`/${locale}/account/bookings/${booking.id}`);
  redirect(`/${locale}/account/bookings/${booking.id}#payment`);
}

export async function editOptionsAction(localeRaw: string, bookingId: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) redirect(`/${locale}/login`);
  await db.booking.updateMany({
    where: { id: bookingId, patientId: patient.id, status: "CONFIRMED" },
    data: { optionsChosen: false },
  });
  await db.payment.updateMany({ where: { bookingId, status: "PENDING" }, data: { status: "FAILED" } });
  redirect(`/${locale}/account/bookings/${bookingId}#options`);
}

export async function startPaymentAction(
  localeRaw: string,
  bookingId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) return fail("errors.loginRequired");

  const provider = getProvider(String(formData.get("provider") ?? ""));
  if (!provider) return fail("errors.providerUnavailable");

  const booking = await db.booking.findFirst({
    where: { id: bookingId, patientId: patient.id },
    include: { operation: true },
  });
  if (!booking || booking.status !== "CONFIRMED" || !booking.optionsChosen) return fail("errors.invalid");
  if (booking.paymentDeadline && booking.paymentDeadline < new Date()) return fail("errors.deadlinePassed");

  const payment = await db.payment.create({
    data: { bookingId: booking.id, provider: provider.id, amount: booking.totalAmount, currency: booking.currency },
  });
  const base = `${appUrl()}/${locale}/account/bookings/${booking.id}`;
  const t = getT(locale);
  let checkoutUrl: string;
  try {
    const session = await provider.createCheckout({
      paymentId: payment.id,
      bookingId: booking.id,
      reference: booking.reference,
      amount: booking.totalAmount,
      currency: booking.currency,
      // Neutral wording: this text appears on the checkout page and card statements.
      description: t("payment.description", { reference: booking.reference }),
      customer: { email: patient.email, firstName: patient.firstName, lastName: patient.lastName, phone: patient.phone },
      successUrl: `${base}?payment=success`,
      cancelUrl: `${base}?payment=cancelled`,
      webhookUrl: `${appUrl()}/api/webhooks/${provider.id}`,
      locale,
    });
    await db.payment.update({
      where: { id: payment.id },
      data: { providerRef: session.providerRef, checkoutUrl: session.checkoutUrl },
    });
    checkoutUrl = session.checkoutUrl;
  } catch (error) {
    console.error("[payments] checkout creation failed", error);
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return fail("errors.paymentFailed");
  }
  redirect(checkoutUrl);
}

export async function cancelBookingAction(localeRaw: string, bookingId: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) redirect(`/${locale}/login`);
  await db.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id: bookingId, patientId: patient.id, status: { in: ["REQUESTED", "CONFIRMED"] } },
    });
    if (!booking) return;
    await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await tx.slot.updateMany({ where: { id: booking.slotId, status: "HELD" }, data: { status: "FREE" } });
    await tx.payment.updateMany({ where: { bookingId: booking.id, status: "PENDING" }, data: { status: "FAILED" } });
  });
  redirect(`/${locale}/account/bookings/${bookingId}`);
}

/** Development-only fake checkout. Disabled unless PAYMENT_MOCK=true. */
export async function mockCheckoutAction(localeRaw: string, paymentId: string, formData: FormData): Promise<void> {
  const locale = toLocale(localeRaw);
  if (!mockPaymentsEnabled()) redirect(`/${locale}`);
  const patient = await currentPatient();
  if (!patient) redirect(`/${locale}/login`);
  const payment = await db.payment.findFirst({
    where: {
      id: paymentId,
      provider: "mock",
      OR: [{ booking: { patientId: patient.id } }, { consultation: { patientId: patient.id } }],
    },
  });
  if (!payment) redirect(`/${locale}/account`);
  const succeed = formData.get("result") === "success";
  if (succeed) await markPaymentSucceeded({ id: payment.id });
  else await markPaymentFailed({ id: payment.id });
  const target = payment.consultationId
    ? `/account/consultations/${payment.consultationId}`
    : `/account/bookings/${payment.bookingId}`;
  redirect(`/${locale}${target}?payment=${succeed ? "success" : "cancelled"}`);
}

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).refine(isLatinName, { message: "latin" }),
  lastName: z.string().trim().min(1).max(80).refine(isLatinName, { message: "latin" }),
  phone: z.string().trim().max(30).optional().transform((v) => v || null),
  country: z.string().trim().max(80).optional().transform((v) => v || null),
  birthDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(`${v}T12:00:00Z`) : null))
    .refine((d) => d === null || (!Number.isNaN(d.getTime()) && d < new Date() && d.getUTCFullYear() > 1900)),
  locale: z.enum(["fr", "en", "ar"]),
});

/** The patient edits their own profile; names stay in Latin letters (they appear on prescriptions). */
export async function updateProfileAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  toLocale(localeRaw);
  const patient = await currentPatient();
  if (!patient) return fail("errors.loginRequired");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message === "latin" ? "errors.nameNotLatin" : "errors.missingFields");
  await db.user.update({ where: { id: patient.id }, data: parsed.data });
  revalidatePath(`/${parsed.data.locale}/account`);
  return ok("profile.saved");
}
