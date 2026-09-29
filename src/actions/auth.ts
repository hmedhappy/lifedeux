"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, homeFor, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { toLocale } from "@/lib/i18n";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { sendTemplate } from "@/lib/mail";
import { randomToken } from "@/lib/tokens";
import { IMAGE_PATH_PREFIX, saveUploadedImages } from "@/lib/images";

/** Only same-site relative paths are accepted as post-login destinations. */
function safeNext(next: FormDataEntryValue | null, locale: string): string | null {
  if (typeof next !== "string" || !next.startsWith(`/${locale}/`) || next.startsWith("//")) return null;
  return next;
}

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  return `${prefix}:${h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"}`;
}

const passwordSchema = z.string().min(8).max(128);

export async function loginAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // Per account (stops password guessing) and a looser cap per IP (a team may share one office IP).
  const ipKey = await clientKey("login");
  const windowMs = 15 * 60 * 1000;
  if (!rateLimit(`${ipKey}:${email}`, 10, windowMs) || !rateLimit(ipKey, 100, windowMs)) {
    return fail("errors.tooManyAttempts");
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return fail("errors.invalidCredentials");
  }
  await createSession(user);
  redirect(safeNext(formData.get("next"), locale) ?? `/${locale}${homeFor(user.role)}`);
}

const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().min(6).max(30),
  country: z.string().trim().min(2).max(80),
  password: passwordSchema,
  consent: z.literal("on"),
});

export async function registerAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  if (!rateLimit(await clientKey("register"), 10, 60 * 60 * 1000)) return fail("errors.tooManyAttempts");

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "password") return fail("errors.weakPassword");
    if (field === "consent") return fail("errors.consentRequired");
    if (field === "email") return fail("errors.invalidEmail");
    return fail("errors.missingFields");
  }
  const data = parsed.data;
  if (await db.user.findUnique({ where: { email: data.email } })) return fail("errors.emailTaken");

  const user = await db.user.create({
    data: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      country: data.country,
      passwordHash: await hashPassword(data.password),
      role: "PATIENT",
      locale,
      consentAt: new Date(),
    },
  });
  await createSession(user);
  redirect(safeNext(formData.get("next"), locale) ?? `/${locale}/account`);
}

export async function acceptInviteAction(
  localeRaw: string,
  token: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!passwordSchema.safeParse(password).success) return fail("errors.weakPassword");
  if (password !== confirm) return fail("errors.passwordMismatch");

  const user = await db.user.findUnique({ where: { inviteToken: token } });
  if (!user || !user.active || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) return fail("errors.inviteInvalid");

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      inviteToken: null,
      inviteExpiresAt: null,
      consentAt: user.consentAt ?? new Date(),
      locale,
    },
  });
  await createSession(updated);
  redirect(`/${locale}${homeFor(updated.role)}`);
}

const RESET_TTL_MS = 60 * 60 * 1000;

/** Always answers the same way so the form cannot be used to discover accounts. */
export async function requestPasswordResetAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  if (!rateLimit(await clientKey("reset"), 5, 60 * 60 * 1000)) return fail("errors.tooManyAttempts");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = email ? await db.user.findUnique({ where: { email } }) : null;
  if (user && user.active) {
    const token = randomToken(24);
    await db.user.update({
      where: { id: user.id },
      data: { inviteToken: token, inviteExpiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    await sendTemplate({ ...user, locale }, "reset", {}, `/reset/${token}`);
  }
  return ok("auth.resetSent");
}

export async function logoutAction(localeRaw: string): Promise<void> {
  await destroySession();
  redirect(`/${toLocale(localeRaw)}`);
}

const joinSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().min(6).max(30),
  password: passwordSchema,
  specialtyId: z.string().trim().min(1).max(40),
  specialty: z.string().trim().min(1).max(120),
  licenseNumber: z.string().trim().min(1).max(60),
  clinicName: z.string().trim().min(1).max(160),
  clinicAddress: z.string().trim().min(1).max(300),
  city: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(4000).optional().default(""),
  consent: z.literal("on"),
});

/** Doctor sign-up through a super-doctor's referral link: the account is active at once. */
export async function joinAsDoctorAction(
  localeRaw: string,
  code: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  if (!rateLimit(await clientKey("join"), 10, 60 * 60 * 1000)) return fail("errors.tooManyAttempts");
  const referrer = await db.doctor.findFirst({
    where: { referralCode: code, active: true, user: { role: "SUPER_DOCTOR", active: true } },
  });
  if (!referrer) return fail("errors.referralInvalid");

  const parsed = joinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "password") return fail("errors.weakPassword");
    if (field === "consent") return fail("errors.consentRequired");
    if (field === "email") return fail("errors.invalidEmail");
    return fail("errors.missingFields");
  }
  const d = parsed.data;
  if (!(await db.specialty.findUnique({ where: { id: d.specialtyId } }))) return fail("errors.missingFields");
  if (await db.user.findUnique({ where: { email: d.email } })) return fail("errors.emailTaken");

  const opts = { private: true, types: ["image/png", "image/jpeg"] } as const;
  const stamp = await saveUploadedImages(formData, "stampFile", 1, opts);
  if ("error" in stamp) return fail(stamp.error);
  const signature = await saveUploadedImages(formData, "signatureFile", 1, opts);
  if ("error" in signature) return fail(signature.error);
  const imageId = (paths: string[]) => (paths[0] ? paths[0].slice(IMAGE_PATH_PREFIX.length) : null);

  const user = await db.user.create({
    data: {
      email: d.email,
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      passwordHash: await hashPassword(d.password),
      role: "DOCTOR",
      locale,
      consentAt: new Date(),
      doctor: {
        create: {
          specialty: d.specialty,
          specialtyId: d.specialtyId,
          licenseNumber: d.licenseNumber,
          bio: d.bio,
          languages: [],
          clinicName: d.clinicName,
          clinicAddress: d.clinicAddress,
          city: d.city,
          referredById: referrer.id,
          stampImageId: imageId(stamp.paths),
          signatureImageId: imageId(signature.paths),
        },
      },
    },
  });
  await createSession(user);
  redirect(`/${locale}/doctor/slots?welcome=1`);
}
