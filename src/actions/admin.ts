"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { INVITE_TTL_DAYS } from "@/lib/constants";
import { parseMoneyToCents } from "@/lib/format";
import { toLocale } from "@/lib/i18n";
import { sendTemplate } from "@/lib/mail";
import { stripeClient } from "@/lib/payments/stripe";
import { appUrl } from "@/lib/settings";
import { randomToken, referralCode } from "@/lib/tokens";
import { IMAGE_PATH_PREFIX, isPhotoRef, saveUploadedImages } from "@/lib/images";
import { isLatinName } from "@/lib/latin";

async function currentAdmin() {
  const user = await getCurrentUser();
  return user && user.role === "ADMIN" ? user : null;
}

const text = (max: number) => z.string().trim().min(1).max(max);
/** Names are printed on prescriptions, whose PDF is in Latin letters only. */
const latinName = () => text(80).refine(isLatinName, { message: "latin" });
const parseError = (error?: z.ZodError) =>
  error?.issues.some((i) => i.message === "latin") ? "errors.nameNotLatin" : "errors.missingFields";
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

function list(value: FormDataEntryValue | null, separator: RegExp = /[,\n]/): string[] {
  return String(value ?? "")
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}

function money(formData: FormData, name: string): number | null {
  return parseMoneyToCents(String(formData.get(name) ?? ""));
}

async function issueInvite(userId: string, locale: string) {
  const token = randomToken(24);
  const user = await db.user.update({
    where: { id: userId },
    data: { inviteToken: token, inviteExpiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000) },
  });
  const link = `${appUrl()}/${toLocale(user.locale || locale)}/invite/${token}`;
  await sendTemplate(user, "invite", { link }, `/invite/${token}`);
  return link;
}

/* ----------------------------- Doctors ----------------------------- */

const doctorSchema = z.object({
  firstName: latinName(),
  lastName: latinName(),
  phone: optionalText(30),
  specialty: text(120),
  bio: text(4000),
  clinicName: text(160),
  clinicAddress: text(300),
  city: text(80),
  photoUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || isPhotoRef(v)),
  yearsOfExperience: z.coerce.number().int().min(0).max(70),
  locale: z.enum(["fr", "en", "ar"]),
  specialtyId: z.string().trim().min(1).max(40),
  licenseNumber: optionalText(60),
  consultationMinutes: z.coerce.number().int().min(10).max(120).default(30),
});

type DoctorExtras = {
  offersConsultation: boolean;
  consultationPrice: number | null;
  consultationFee: number | null;
  superDoctor: boolean;
};

/** Consultation pricing is optional: empty fields fall back to the specialty defaults. */
function readConsultation(formData: FormData): DoctorExtras | null {
  const offersConsultation = formData.get("offersConsultation") === "on";
  const rawPrice = String(formData.get("consultationPrice") ?? "").trim();
  const rawFee = String(formData.get("consultationFee") ?? "").trim();
  const consultationPrice = rawPrice ? parseMoneyToCents(rawPrice) : null;
  const consultationFee = rawFee ? parseMoneyToCents(rawFee) : null;
  if ((rawPrice && !consultationPrice) || (rawFee && consultationFee === null)) return null;
  if (consultationPrice !== null && consultationFee !== null && consultationFee > consultationPrice) return null;
  return { offersConsultation, consultationPrice, consultationFee, superDoctor: formData.get("superDoctor") === "on" };
}

/** Stamp and signature stay private: they only ever appear inside prescriptions. */
async function readSignatureImages(formData: FormData) {
  const opts = { private: true, types: ["image/png", "image/jpeg"] } as const;
  const stamp = await saveUploadedImages(formData, "stampFile", 1, opts);
  if ("error" in stamp) return stamp;
  const signature = await saveUploadedImages(formData, "signatureFile", 1, opts);
  if ("error" in signature) return signature;
  const id = (paths: string[]) => (paths[0] ? paths[0].slice(IMAGE_PATH_PREFIX.length) : undefined);
  return { stampImageId: id(stamp.paths), signatureImageId: id(signature.paths) };
}

async function readPricing(formData: FormData) {
  const operations = await db.operation.findMany();
  const pricing: { operationId: string; price: number; doctorFee: number }[] = [];
  for (const op of operations) {
    if (formData.get(`op_${op.id}`) !== "on") continue;
    const price = money(formData, `price_${op.id}`);
    const fee = money(formData, `fee_${op.id}`);
    if (price === null || fee === null || price <= 0 || fee < 0 || fee > price) return null;
    pricing.push({ operationId: op.id, price, doctorFee: fee });
  }
  return pricing;
}

export async function createDoctorAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  if (!(await currentAdmin())) return fail("errors.forbidden");
  const parsed = doctorSchema.safeParse(Object.fromEntries(formData));
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!parsed.success || !email.success) return fail(parseError(parsed.error));
  const pricing = await readPricing(formData);
  const extras = readConsultation(formData);
  if (!pricing || !extras) return fail("errors.pricing");
  if (pricing.length === 0 && !extras.offersConsultation) return fail("errors.noService");
  if (!(await db.specialty.findUnique({ where: { id: parsed.data.specialtyId } }))) return fail("errors.missingFields");
  if (await db.user.findUnique({ where: { email: email.data } })) return fail("errors.emailTaken");
  const upload = await saveUploadedImages(formData, "photoFile", 1);
  if ("error" in upload) return fail(upload.error);
  const signatures = await readSignatureImages(formData);
  if ("error" in signatures) return fail(signatures.error);

  const d = { ...parsed.data, photoUrl: upload.paths[0] ?? parsed.data.photoUrl };
  const user = await db.user.create({
    data: {
      email: email.data,
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      role: extras.superDoctor ? "SUPER_DOCTOR" : "DOCTOR",
      locale: d.locale,
      doctor: {
        create: {
          specialty: d.specialty,
          specialtyId: d.specialtyId,
          licenseNumber: d.licenseNumber,
          consultationMinutes: d.consultationMinutes,
          offersConsultation: extras.offersConsultation,
          consultationPrice: extras.consultationPrice,
          consultationFee: extras.consultationFee,
          referralCode: extras.superDoctor ? referralCode() : null,
          ...signatures,
          bio: d.bio,
          languages: list(formData.get("languages")),
          clinicName: d.clinicName,
          clinicAddress: d.clinicAddress,
          city: d.city,
          photoUrl: d.photoUrl,
          yearsOfExperience: d.yearsOfExperience,
          operations: { create: pricing },
        },
      },
    },
    include: { doctor: true },
  });
  const link = await issueInvite(user.id, locale);
  revalidatePath(`/${locale}/admin/doctors`);
  return ok("admin.inviteSent", { vars: { email: user.email }, detail: link });
}

export async function updateDoctorAction(
  localeRaw: string,
  doctorId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  if (!(await currentAdmin())) return fail("errors.forbidden");
  const parsed = doctorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parseError(parsed.error));
  const pricing = await readPricing(formData);
  const extras = readConsultation(formData);
  if (!pricing || !extras) return fail("errors.pricing");
  if (pricing.length === 0 && !extras.offersConsultation) return fail("errors.noService");
  const doctor = await db.doctor.findUnique({ where: { id: doctorId }, include: { user: true } });
  if (!doctor) return fail("errors.invalid");
  if (!(await db.specialty.findUnique({ where: { id: parsed.data.specialtyId } }))) return fail("errors.missingFields");
  const upload = await saveUploadedImages(formData, "photoFile", 1);
  if ("error" in upload) return fail(upload.error);
  const signatures = await readSignatureImages(formData);
  if ("error" in signatures) return fail(signatures.error);

  const d = { ...parsed.data, photoUrl: upload.paths[0] ?? parsed.data.photoUrl };
  const active = formData.get("active") === "on";
  await db.$transaction([
    db.user.update({
      where: { id: doctor.userId },
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        phone: d.phone,
        locale: d.locale,
        active,
        role: extras.superDoctor ? "SUPER_DOCTOR" : "DOCTOR",
      },
    }),
    db.doctor.update({
      where: { id: doctorId },
      data: {
        specialty: d.specialty,
        specialtyId: d.specialtyId,
        licenseNumber: d.licenseNumber,
        consultationMinutes: d.consultationMinutes,
        offersConsultation: extras.offersConsultation,
        consultationPrice: extras.consultationPrice,
        consultationFee: extras.consultationFee,
        referralCode: extras.superDoctor ? (doctor.referralCode ?? referralCode()) : doctor.referralCode,
        ...(signatures.stampImageId ? { stampImageId: signatures.stampImageId } : {}),
        ...(signatures.signatureImageId ? { signatureImageId: signatures.signatureImageId } : {}),
        bio: d.bio,
        languages: list(formData.get("languages")),
        clinicName: d.clinicName,
        clinicAddress: d.clinicAddress,
        city: d.city,
        photoUrl: d.photoUrl,
        yearsOfExperience: d.yearsOfExperience,
        active,
      },
    }),
    db.doctorOperation.deleteMany({ where: { doctorId } }),
    db.doctorOperation.createMany({ data: pricing.map((p) => ({ ...p, doctorId })) }),
  ]);
  revalidatePath(`/${locale}/admin/doctors`);
  return ok("admin.saved");
}

export async function resendInviteAction(localeRaw: string, userId: string): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  if (!(await currentAdmin())) return fail("errors.forbidden");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.role === "PATIENT") return fail("errors.invalid");
  const link = await issueInvite(user.id, locale);
  return ok("admin.inviteSent", { vars: { email: user.email }, detail: link });
}

/* ------------------------------ Team ------------------------------ */

export async function inviteTeamMemberAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  if (!(await currentAdmin())) return fail("errors.forbidden");
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email(),
      firstName: latinName(),
      lastName: latinName(),
      phone: optionalText(30),
      role: z.enum(["AGENT", "ADMIN"]),
      locale: z.enum(["fr", "en", "ar"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parseError(parsed.error));
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) return fail("errors.emailTaken");
  const user = await db.user.create({ data: { ...parsed.data, role: parsed.data.role as Role } });
  const link = await issueInvite(user.id, locale);
  revalidatePath(`/${locale}/admin/team`);
  return ok("admin.inviteSent", { vars: { email: user.email }, detail: link });
}

export async function toggleUserActiveAction(localeRaw: string, userId: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const admin = await currentAdmin();
  if (!admin || admin.id === userId) return;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await db.user.update({ where: { id: userId }, data: { active: !user.active } });
  revalidatePath(`/${locale}/admin/team`);
}

/* --------------------------- Operations --------------------------- */

export async function saveOperationAction(
  localeRaw: string,
  operationId: string | null,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  if (!(await currentAdmin())) return fail("errors.forbidden");
  const parsed = z
    .object({
      slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,60}$/),
      nameFr: text(160),
      nameEn: text(160),
      nameAr: text(160),
      descriptionFr: text(4000),
      descriptionEn: text(4000),
      descriptionAr: text(4000),
      defaultRecoveryNights: z.coerce.number().int().min(1).max(60),
    })
    .safeParse(Object.fromEntries(formData));
  const basePrice = money(formData, "basePrice");
  if (!parsed.success || basePrice === null) return fail("errors.missingFields");
  const data = { ...parsed.data, basePrice, active: formData.get("active") === "on" };

  const clash = await db.operation.findUnique({ where: { slug: data.slug } });
  if (clash && clash.id !== operationId) return fail("errors.slugTaken");

  if (operationId) await db.operation.update({ where: { id: operationId }, data });
  else await db.operation.create({ data });
  revalidatePath(`/${locale}/admin/operations`);
  if (!operationId) redirect(`/${locale}/admin/operations`);
  return ok("admin.saved");
}

/* ------------------------- Accommodations ------------------------- */

export async function saveStayAction(
  localeRaw: string,
  stayId: string | null,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  if (!(await currentAdmin())) return fail("errors.forbidden");
  const parsed = z
    .object({
      title: text(160),
      type: z.enum(["APARTMENT", "HOUSE"]),
      city: text(80),
      address: text(300),
      description: text(4000),
      capacity: z.coerce.number().int().min(1).max(30),
      bedrooms: z.coerce.number().int().min(0).max(30),
    })
    .safeParse(Object.fromEntries(formData));
  const pricePerNight = money(formData, "pricePerNight");
  if (!parsed.success || pricePerNight === null) return fail("errors.missingFields");
  const photos = list(formData.get("photos"), /\n/);
  if (photos.some((p) => !isPhotoRef(p))) return fail("errors.photoUrls");
  const upload = await saveUploadedImages(formData, "photoFiles");
  if ("error" in upload) return fail(upload.error);
  photos.push(...upload.paths);

  const data = {
    ...parsed.data,
    pricePerNight,
    amenities: list(formData.get("amenities")),
    photos,
    active: formData.get("active") === "on",
  };
  if (stayId) await db.accommodation.update({ where: { id: stayId }, data });
  else await db.accommodation.create({ data });
  revalidatePath(`/${locale}/admin/stays`);
  if (!stayId) redirect(`/${locale}/admin/stays`);
  return ok("admin.saved");
}

/* ---------------------------- Bookings ---------------------------- */

export async function adminCancelBookingAction(localeRaw: string, bookingId: string): Promise<void> {
  const locale = toLocale(localeRaw);
  if (!(await currentAdmin())) return;
  await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || !["REQUESTED", "CONFIRMED", "PAID"].includes(booking.status)) return;
    await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await tx.slot.updateMany({ where: { id: booking.slotId, status: { in: ["HELD", "BOOKED"] } }, data: { status: "FREE" } });
    await tx.payment.updateMany({ where: { bookingId: booking.id, status: "PENDING" }, data: { status: "FAILED" } });
  });
  revalidatePath(`/${locale}/admin/bookings/${bookingId}`);
}

/** Refunds through Stripe when possible, otherwise records a refund made outside the platform. */
export async function refundPaymentAction(localeRaw: string, paymentId: string): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  if (!(await currentAdmin())) return fail("errors.forbidden");
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "SUCCEEDED") return fail("errors.invalid");

  if (payment.provider === "stripe" && payment.providerRef && process.env.STRIPE_SECRET_KEY) {
    try {
      const session = await stripeClient().checkout.sessions.retrieve(payment.providerRef);
      const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (!intent) return fail("errors.refundFailed");
      await stripeClient().refunds.create({ payment_intent: intent }, { idempotencyKey: `refund-${payment.id}` });
    } catch (error) {
      console.error("[stripe] refund failed", error);
      return fail("errors.refundFailed");
    }
  }
  await db.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
  revalidatePath(`/${locale}/admin/bookings/${payment.bookingId}`);
  return ok(payment.provider === "stripe" ? "admin.refunded" : "admin.refundRecorded");
}

/* ----------------------------- Payouts ----------------------------- */

export async function recordPayoutAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const admin = await currentAdmin();
  if (!admin) return fail("errors.forbidden");
  const doctorId = String(formData.get("doctorId") ?? "");
  const amount = money(formData, "amount");
  const paidAt = String(formData.get("paidAt") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  if (!amount || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) return fail("errors.missingFields");
  if (!(await db.doctor.findUnique({ where: { id: doctorId } }))) return fail("errors.invalid");
  await db.doctorPayout.create({
    data: { doctorId, amount, paidAt: new Date(`${paidAt}T12:00:00+01:00`), note, recordedById: admin.id },
  });
  revalidatePath(`/${locale}/admin/payouts`);
  return ok("admin.payoutRecorded");
}

/* ----------------------------- Settings ---------------------------- */

export async function saveSettingsAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  if (!(await currentAdmin())) return fail("errors.forbidden");
  const parsed = z
    .object({
      currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
      paymentDeadlineHours: z.coerce.number().int().min(1).max(720),
      maxCompanions: z.coerce.number().int().min(0).max(10),
      supportPhone: text(40),
      supportEmail: z.string().trim().email(),
    })
    .safeParse(Object.fromEntries(formData));
  const transportPricePerPerson = money(formData, "transportPricePerPerson");
  if (!parsed.success || transportPricePerPerson === null) return fail("errors.missingFields");
  await db.setting.upsert({
    where: { id: 1 },
    update: { ...parsed.data, transportPricePerPerson },
    create: { id: 1, ...parsed.data, transportPricePerPerson },
  });
  revalidatePath(`/${locale}`, "layout");
  return ok("admin.saved");
}

/** Validates (or rejects) the stamp a doctor sent from their space. */
export async function reviewStampAction(localeRaw: string, doctorId: string, approve: boolean): Promise<void> {
  const locale = toLocale(localeRaw);
  if (!(await currentAdmin())) redirect(`/${locale}/login`);
  const doctor = await db.doctor.findUnique({ where: { id: doctorId } });
  if (doctor?.pendingStampImageId) {
    await db.$transaction([
      db.doctor.update({
        where: { id: doctorId },
        data: approve ? { stampImageId: doctor.pendingStampImageId, pendingStampImageId: null } : { pendingStampImageId: null },
      }),
      db.alert.updateMany({ where: { doctorId, kind: "stampToReview", resolvedAt: null }, data: { resolvedAt: new Date() } }),
    ]);
  }
  revalidatePath(`/${locale}/admin`, "layout");
}
