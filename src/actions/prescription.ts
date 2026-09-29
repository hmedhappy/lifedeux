"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sendTemplate } from "@/lib/mail";
import { contentHash, loadPrescription, prescriptionNumber } from "@/lib/prescriptions";
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
});

export type PrescriptionDraft = z.infer<typeof draftSchema>;
type Result = { ok: true; id: string } | { ok: false; error: string };

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
  const { items, notes } = parsed.data;

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
      db.prescription.update({ where: { id: existing.id }, data: { notes: notes || null, items: { create: data } } }),
    ]);
    return { ok: true, id: existing.id };
  }
  const created = await db.prescription.create({
    data: {
      consultationId,
      doctorId: ctx.consultation.doctorId,
      patientId: ctx.consultation.patientId,
      notes: notes || null,
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

  await db.$transaction([
    db.prescription.update({ where: { id: prescriptionId }, data: { status: "ISSUED", number, issuedAt, contentHash: hash } }),
    db.message.create({
      data: { consultationId: draft.consultationId, senderId: ctx.user.id, kind: "PRESCRIPTION", prescriptionId },
    }),
  ]);
  const patient = await db.user.findUniqueOrThrow({ where: { id: draft.patientId } });
  await sendTemplate(patient, "prescription", { reference: number }, `/account/consultations/${draft.consultationId}`);
  return { ok: true, id: prescriptionId };
}
