"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, getCurrentUser } from "@/lib/auth";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { parseMoneyToCents } from "@/lib/format";
import { toLocale } from "@/lib/i18n";
import { isLatinName } from "@/lib/latin";
import { sendTemplate } from "@/lib/mail";
import { appUrl } from "@/lib/settings";
import { randomToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { DOCTOR_INVITE_TTL_DAYS, findDoctorInvite } from "@/lib/doctor-invites";

async function currentAdmin() {
  const user = await getCurrentUser();
  return user && user.role === "ADMIN" ? user : null;
}

async function sendDoctorInvite(email: string, locale: string, invitedById: string | null) {
  const token = randomToken(24);
  await db.doctorInvite.create({
    data: { email, token, locale, invitedById, expiresAt: new Date(Date.now() + DOCTOR_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000) },
  });
  await sendTemplate({ email, firstName: "", locale }, "doctorInvite", { days: String(DOCTOR_INVITE_TTL_DAYS) }, `/onboard/${token}`);
  return `${appUrl()}/${locale}/onboard/${token}`;
}

/** Admin: sends a sign-up link to a doctor, who then fills in their own profile. Only the email is needed. */
export async function inviteDoctorByEmailAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const admin = await currentAdmin();
  if (!admin) return fail("errors.forbidden");
  const email = z.string().trim().toLowerCase().email().max(200).safeParse(formData.get("email"));
  if (!email.success) return fail("errors.invalidEmail");
  if (await db.user.findUnique({ where: { email: email.data } })) return fail("errors.emailTaken");
  const inviteLocale = toLocale(String(formData.get("locale") ?? locale));
  // A new link replaces the previous ones for this address.
  await db.doctorInvite.updateMany({ where: { email: email.data, usedAt: null }, data: { expiresAt: new Date() } });
  const link = await sendDoctorInvite(email.data, inviteLocale, admin.id);
  await audit(admin.id, "doctor.inviteLink", email.data, {});
  revalidatePath(`/${locale}/admin/doctors`);
  return ok("admin.doctorInvite.sent", { vars: { email: email.data }, detail: link });
}

export async function resendDoctorInviteAction(localeRaw: string, inviteId: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const admin = await currentAdmin();
  if (!admin) redirect(`/${locale}/login`);
  const invite = await db.doctorInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.usedAt || (await db.user.findUnique({ where: { email: invite.email } }))) return;
  await db.doctorInvite.updateMany({ where: { email: invite.email, usedAt: null }, data: { expiresAt: new Date() } });
  await sendDoctorInvite(invite.email, invite.locale, admin.id);
  revalidatePath(`/${locale}/admin/doctors`);
}

const name = z.string().trim().min(1).max(80).refine(isLatinName, { message: "latin" });
const onboardSchema = z.object({
  firstName: name,
  lastName: name,
  phone: z.string().trim().max(30).optional().transform((v) => v || null),
  specialtyId: z.string().trim().min(1).max(40),
  mode: z.enum(["clinic", "online", "both"]),
  clinicName: z.string().trim().max(160).optional().default(""),
  clinicAddress: z.string().trim().max(300).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  clinicLat: z.coerce.number().min(-90).max(90).optional().catch(undefined),
  clinicLng: z.coerce.number().min(-180).max(180).optional().catch(undefined),
  onlinePrice: z.string().optional(),
  clinicPrice: z.string().optional(),
  consent: z.literal("on"),
});

/** Doctor sign-up from the emailed link: three steps, then straight into the doctor area. */
export async function completeDoctorOnboardingAction(
  localeRaw: string,
  token: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const invite = await findDoctorInvite(token);
  if (!invite) return fail("onboard.invalid");
  if (await db.user.findUnique({ where: { email: invite.email } })) return fail("errors.emailTaken");

  const raw = Object.fromEntries(formData);
  const parsed = onboardSchema.safeParse({ ...raw, clinicLat: raw.clinicLat || undefined, clinicLng: raw.clinicLng || undefined });
  if (!parsed.success) {
    return fail(parsed.error.issues.some((i) => i.message === "latin") ? "errors.nameNotLatin" : "errors.missingFields");
  }
  const d = parsed.data;
  const atClinic = d.mode !== "online";
  const online = d.mode !== "clinic";
  if (atClinic && (!d.clinicAddress || !d.city)) return fail("errors.missingFields");

  const onlinePrice = online ? parseMoneyToCents(d.onlinePrice ?? "") : null;
  const clinicPrice = atClinic ? parseMoneyToCents(d.clinicPrice ?? "") : null;
  if ((online && !onlinePrice) || (atClinic && !clinicPrice)) return fail("errors.pricing");

  const specialty = await db.specialty.findUnique({ where: { id: d.specialtyId } });
  if (!specialty) return fail("errors.missingFields");

  const user = await db.$transaction(async (tx) => {
    // Claimed first, so a double submit cannot create two accounts.
    const claimed = await tx.doctorInvite.updateMany({ where: { id: invite.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count === 0) return null;
    return tx.user.create({
      data: {
        email: invite.email,
        firstName: d.firstName,
        lastName: d.lastName,
        phone: d.phone,
        role: "DOCTOR",
        locale,
        consentAt: new Date(),
        doctor: {
          create: {
            specialty: specialty.nameFr,
            specialtyId: specialty.id,
            bio: "",
            languages: [],
            clinicName: atClinic ? d.clinicName || `Cabinet Dr ${d.lastName}` : "",
            clinicAddress: atClinic ? d.clinicAddress : "",
            city: d.city,
            clinicLat: atClinic ? (d.clinicLat ?? null) : null,
            clinicLng: atClinic ? (d.clinicLng ?? null) : null,
            // Online consultations open once the stamp is validated (see consultationOffer).
            offersConsultation: online,
            consultationPrice: onlinePrice,
            offersInPerson: atClinic,
            inPersonPrice: clinicPrice,
            onboardingDoneAt: new Date(),
          },
        },
      },
    });
  });
  if (!user) return fail("onboard.invalid");
  if (invite.invitedById) await audit(invite.invitedById, "doctor.onboarded", user.id, { email: user.email });
  await createSession(user);
  redirect(`/${locale}/doctor?welcome=1`);
}
