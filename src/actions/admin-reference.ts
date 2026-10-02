"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { parseMoneyToCents } from "@/lib/format";
import { toLocale } from "@/lib/i18n";
import { medicationSearchText } from "@/lib/search-text";
import { MAX_IMPORT_ROWS, parseCsv } from "@/lib/csv";
import { audit } from "@/lib/audit";

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

async function readCsv(formData: FormData): Promise<string> {
  const file = formData.get("file");
  if (file && typeof file === "object" && "text" in file && file.size > 0) return (await file.text()).slice(0, 2_000_000);
  return String(formData.get("csv") ?? "");
}

/**
 * Medication catalogue import. Columns: name (required), dci, form, strength,
 * specialty (slug). Existing lines (same name, strength and form) are skipped.
 */
export async function importMedicationsAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return fail("errors.forbidden");
  const { headers, rows } = parseCsv(await readCsv(formData));
  if (!headers.includes("name")) return fail("errors.csvColumns", { columns: "name" });
  if (rows.length > MAX_IMPORT_ROWS) return fail("errors.csvTooLong", { n: MAX_IMPORT_ROWS });
  const specialties = new Map((await db.specialty.findMany({ select: { id: true, slug: true } })).map((s) => [s.slug, s.id]));
  let created = 0;
  let skipped = 0;
  for (const r of rows) {
    const m = medicationSchema.safeParse({ name: r.name, dci: r.dci, form: r.form, strength: r.strength, specialtyId: specialties.get(r.specialty ?? "") });
    if (!m.success) {
      skipped++;
      continue;
    }
    const exists = await db.medication.findFirst({ where: { name: m.data.name, strength: m.data.strength, form: m.data.form } });
    if (exists) {
      skipped++;
      continue;
    }
    await db.medication.create({ data: { ...m.data, searchText: medicationSearchText(m.data) } });
    created++;
  }
  await audit(user.id, "import.medications", null, { created, skipped });
  revalidatePath(`/${locale}/admin/medications`);
  return ok("import.done", { vars: { created, skipped } });
}
