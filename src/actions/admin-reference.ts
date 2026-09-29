"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { parseMoneyToCents } from "@/lib/format";
import { toLocale } from "@/lib/i18n";
import { medicationSearchText } from "@/lib/search-text";

async function isAdmin() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN";
}

export async function updateSpecialtyAction(localeRaw: string, id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  if (!(await isAdmin())) return fail("errors.forbidden");
  const price = parseMoneyToCents(String(formData.get("consultationPrice") ?? ""));
  if (!price) return fail("errors.pricing");
  await db.specialty.update({ where: { id }, data: { consultationPrice: price, active: formData.get("active") === "on" } });
  revalidatePath(`/${locale}/admin/specialties`);
  return ok("admin.saved");
}

const medicationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  dci: z.string().trim().max(160).optional().transform((v) => v || null),
  form: z.string().trim().max(60).optional().transform((v) => v || null),
  strength: z.string().trim().max(60).optional().transform((v) => v || null),
  specialtyId: z.string().trim().max(40).optional().transform((v) => v || null),
});

export async function createMedicationAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  if (!(await isAdmin())) return fail("errors.forbidden");
  const parsed = medicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("errors.missingFields");
  const m = parsed.data;
  const duplicate = await db.medication.findFirst({ where: { name: m.name, strength: m.strength, form: m.form } });
  if (duplicate) return fail("errors.medicationExists");
  await db.medication.create({ data: { ...m, searchText: medicationSearchText(m) } });
  revalidatePath(`/${locale}/admin/medications`);
  return ok("admin.medicationAdded", { vars: { name: m.name } });
}

export async function deleteMedicationAction(localeRaw: string, id: string): Promise<void> {
  const locale = toLocale(localeRaw);
  if (!(await isAdmin())) return;
  // Prescriptions keep a copy of the name, so removing the catalogue entry is safe.
  await db.$transaction([
    db.prescriptionItem.updateMany({ where: { medicationId: id }, data: { medicationId: null } }),
    db.medication.delete({ where: { id } }),
  ]);
  revalidatePath(`/${locale}/admin/medications`);
}
