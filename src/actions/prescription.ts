"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sendTemplate } from "@/lib/mail";
import { contentHash, defaultTemplateRef, loadPrescription, prescriptionNumber, resolveTemplate } from "@/lib/prescriptions";
import { builtinConfig } from "@/lib/rx-sheet";
import { isLatinText } from "@/lib/latin";
import { isDoctorRole } from "@/lib/roles";

const itemSchema = z.object({
  medicationId: z.string().max(40).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  dosage: z.string().trim().min(1).max(120),
  frequency: z.string().trim().min(1).max(120),
  duration: z.string().trim().min(1).max(80),
  instructions: z.string().trim().max(300).optional().nullable(),
});

const draftSchema = z.object({
  items: z.array(itemSchema).min(1).max(15),
  notes: z.string().trim().max(1500).optional().nullable(),
  templateRef: z.string().max(60).optional().nullable(),
});

export type PrescriptionDraft = z.infer<typeof draftSchema>;
type Result = { ok: true; id: string } | { ok: false; error: string };

/** The PDF is printed with Latin-only fonts: every free-text field must be in Latin letters. */
function allLatin(input: { items: PrescriptionDraft["items"]; notes?: string | null }): boolean {
  const texts = input.items.flatMap((i) => [i.name, i.dosage, i.frequency, i.duration, i.instructions ?? ""]);
  return [...texts, input.notes ?? ""].every(isLatinText);
}

async function currentDoctor() {
  const user = await getCurrentUser();
  if (!user || !isDoctorRole(user.role)) return null;
  const doctor = await db.doctor.findUnique({ where: { userId: user.id } });
  return doctor ? { user, doctor } : null;
}

async function doctorConsultation(consultationId: string) {
  const user = await getCurrentUser();
  if (!user || !isDoctorRole(user.role)) return null;
  const c = await db.consultation.findFirst({
    where: { id: consultationId, doctor: { userId: user.id }, status: { in: ["PAID", "COMPLETED"] } },
    include: { doctor: true },
  });
  return c ? { user, consultation: c } : null;
}

/** Creates or replaces the doctor's current draft for this consultation. */
export async function savePrescriptionDraftAction(consultationId: string, input: PrescriptionDraft): Promise<Result> {
  const ctx = await doctorConsultation(consultationId);
  if (!ctx) return { ok: false, error: "errors.forbidden" };
  if (!ctx.consultation.doctor.stampImageId) return { ok: false, error: "errors.stampMissing" };
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "errors.prescriptionInvalid" };
  if (!allLatin(parsed.data)) return { ok: false, error: "errors.rxNotLatin" };
  const { items, notes } = parsed.data;
  // Only a built-in design or one of this doctor's own templates can be used.
  const ref = parsed.data.templateRef;
  const templateRef =
    ref && (builtinConfig(ref) || (await db.prescriptionTemplate.findFirst({ where: { id: ref, doctorId: ctx.consultation.doctorId } })))
      ? ref
      : null;

  const existing = await db.prescription.findFirst({ where: { consultationId, status: "DRAFT" } });
  const data = items.map((i, position) => ({
    position,
    medicationId: i.medicationId ?? null,
    name: i.name,
    dosage: i.dosage,
    frequency: i.frequency,
    duration: i.duration,
    instructions: i.instructions || null,
  }));
  if (existing) {
    await db.$transaction([
      db.prescriptionItem.deleteMany({ where: { prescriptionId: existing.id } }),
      db.prescription.update({ where: { id: existing.id }, data: { notes: notes || null, templateRef, items: { create: data } } }),
    ]);
    return { ok: true, id: existing.id };
  }
  const created = await db.prescription.create({
    data: {
      consultationId,
      doctorId: ctx.consultation.doctorId,
      patientId: ctx.consultation.patientId,
      notes: notes || null,
      templateRef,
      items: { create: data },
    },
  });
  return { ok: true, id: created.id };
}

/** Signs the draft (number + fingerprint), then posts it in the chat for the patient. */
export async function issuePrescriptionAction(prescriptionId: string): Promise<Result> {
  const draft = await db.prescription.findUnique({ where: { id: prescriptionId } });
  if (!draft || draft.status !== "DRAFT") return { ok: false, error: "errors.invalid" };
  const ctx = await doctorConsultation(draft.consultationId);
  if (!ctx) return { ok: false, error: "errors.forbidden" };
  if (!ctx.consultation.doctor.stampImageId) return { ok: false, error: "errors.stampMissing" };

  const issuedAt = new Date();
  const number = prescriptionNumber(issuedAt);
  const full = await loadPrescription({ id: prescriptionId });
  if (!full || full.items.length === 0) return { ok: false, error: "errors.prescriptionInvalid" };
  const hash = contentHash({ ...full, number, issuedAt });
  // Freeze the design: later template edits or deletions never change a sent prescription.
  const frozen = JSON.stringify(await resolveTemplate(full.templateRef ?? defaultTemplateRef(full.doctor), full.doctorId));

  await db.$transaction([
    db.prescription.update({
      where: { id: prescriptionId },
      data: { status: "ISSUED", number, issuedAt, contentHash: hash, templateRef: frozen },
    }),
    // A replacement ("Annuler et remplacer") points the cancelled prescription to this one.
    db.prescription.updateMany({
      where: { consultationId: draft.consultationId, status: "REVOKED", revokeReason: "replaced", replacedById: null },
      data: { replacedById: prescriptionId },
    }),
    db.message.create({
      data: { consultationId: draft.consultationId, senderId: ctx.user.id, kind: "PRESCRIPTION", prescriptionId },
    }),
  ]);
  const patient = await db.user.findUniqueOrThrow({ where: { id: draft.patientId } });
  await sendTemplate(patient, "prescription", { reference: number }, `/account/consultations/${draft.consultationId}`);
  // Refreshes the consultation screen so the issued list shows the new number.
  revalidatePath("/[locale]/doctor/consultations/[id]", "page");
  return { ok: true, id: prescriptionId };
}

/* ------------------------- Cancel and replace ------------------------- */

/**
 * The doctor cancels an issued prescription (its QR code then shows it as cancelled)
 * and gets a draft copy to correct and send again.
 */
export async function revokeAndReplaceAction(prescriptionId: string): Promise<Result> {
  const p = await db.prescription.findUnique({ where: { id: prescriptionId }, include: { items: { orderBy: { position: "asc" } } } });
  if (!p || p.status !== "ISSUED") return { ok: false, error: "errors.invalid" };
  const ctx = await doctorConsultation(p.consultationId);
  if (!ctx) return { ok: false, error: "errors.forbidden" };
  await db.$transaction(async (tx) => {
    await tx.prescription.update({ where: { id: p.id }, data: { status: "REVOKED", revokedAt: new Date(), revokeReason: "replaced" } });
    await tx.prescription.deleteMany({ where: { consultationId: p.consultationId, status: "DRAFT" } });
    await tx.prescription.create({
      data: {
        consultationId: p.consultationId,
        doctorId: p.doctorId,
        patientId: p.patientId,
        notes: p.notes,
        items: {
          create: p.items.map(({ position, medicationId, name, dosage, frequency, duration, instructions }) => ({
            position,
            medicationId,
            name,
            dosage,
            frequency,
            duration,
            instructions,
          })),
        },
      },
    });
    await tx.message.create({
      data: { consultationId: p.consultationId, senderId: ctx.user.id, kind: "SYSTEM", text: `rxRevoked:${p.number}` },
    });
  });
  return { ok: true, id: p.id };
}

/** Form version used by the consultation screen: the page then shows the new draft. */
export async function revokeAndReplaceFormAction(locale: string, consultationId: string, prescriptionId: string): Promise<void> {
  await revokeAndReplaceAction(prescriptionId);
  revalidatePath(`/${locale}/doctor/consultations/${consultationId}`);
}

/* ------------------------------ Favorites ------------------------------ */

const favoriteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  items: z.array(itemSchema.partial({ dosage: true, frequency: true, duration: true })).min(1).max(15),
  notes: z.string().trim().max(1500).optional().nullable(),
});

export type FavoriteInput = z.infer<typeof favoriteSchema>;

/** Saves the current lines as a personal "ordonnance type". */
export async function saveFavoriteAction(input: FavoriteInput): Promise<Result> {
  const me = await currentDoctor();
  if (!me) return { ok: false, error: "errors.forbidden" };
  const parsed = favoriteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "errors.prescriptionInvalid" };
  const items = parsed.data.items.map((i) => ({
    medicationId: i.medicationId ?? null,
    name: i.name,
    dosage: i.dosage ?? "",
    frequency: i.frequency ?? "",
    duration: i.duration ?? "",
    instructions: i.instructions ?? "",
  }));
  if (!allLatin({ items, notes: parsed.data.notes })) return { ok: false, error: "errors.rxNotLatin" };
  if ((await db.prescriptionFavorite.count({ where: { doctorId: me.doctor.id } })) >= 30) return { ok: false, error: "errors.tooManyFavorites" };
  const fav = await db.prescriptionFavorite.create({
    data: { doctorId: me.doctor.id, name: parsed.data.name, items, notes: parsed.data.notes || null },
  });
  return { ok: true, id: fav.id };
}

export async function deleteFavoriteAction(id: string): Promise<void> {
  const me = await currentDoctor();
  if (!me) return;
  await db.prescriptionFavorite.deleteMany({ where: { id, doctorId: me.doctor.id } });
}
