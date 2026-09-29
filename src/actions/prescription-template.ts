"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { IMAGE_PATH_PREFIX, saveUploadedImages } from "@/lib/images";
import { toLocale } from "@/lib/i18n";
import { isDoctorRole } from "@/lib/roles";
import { builtinConfig, isHexColor } from "@/lib/rx-sheet";

const MAX_TEMPLATES = 10;

async function currentDoctor() {
  const user = await getCurrentUser();
  if (!user || !isDoctorRole(user.role)) return null;
  return db.doctor.findUnique({ where: { userId: user.id } });
}

const margin = z.coerce.number().int().min(0).max(120);
const schema = z.object({
  name: z.string().trim().min(1).max(60),
  layout: z.enum(["teal", "rose", "letterhead"]),
  color: z.string().refine(isHexColor),
  marginTop: margin,
  marginBottom: margin,
  marginLeft: margin,
  marginRight: margin,
});

export async function createTemplateAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const doctor = await currentDoctor();
  if (!doctor) return fail("errors.forbidden");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("errors.missingFields");
  if ((await db.prescriptionTemplate.count({ where: { doctorId: doctor.id } })) >= MAX_TEMPLATES) return fail("errors.tooManyTemplates");

  // The letterhead is printed as-is behind the text: PNG or JPEG only (what PDFs can embed).
  const upload = await saveUploadedImages(formData, "background", 1, { private: true, types: ["image/png", "image/jpeg"] });
  if ("error" in upload) return fail(upload.error);
  const backgroundImageId = upload.paths[0]?.slice(IMAGE_PATH_PREFIX.length) ?? null;
  if (parsed.data.layout === "letterhead" && !backgroundImageId) return fail("errors.letterheadRequired");

  const t = await db.prescriptionTemplate.create({
    data: { ...parsed.data, doctorId: doctor.id, backgroundImageId: parsed.data.layout === "letterhead" ? backgroundImageId : null },
  });
  if (formData.get("makeDefault") === "on") await db.doctor.update({ where: { id: doctor.id }, data: { prescriptionTemplate: t.id } });
  revalidatePath(`/${locale}/doctor/prescription`);
  return ok("rxTemplates.created", { vars: { name: t.name } });
}

export async function setDefaultTemplateAction(localeRaw: string, ref: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const doctor = await currentDoctor();
  if (!doctor) return;
  const valid = builtinConfig(ref) || (await db.prescriptionTemplate.findFirst({ where: { id: ref, doctorId: doctor.id } }));
  if (valid) await db.doctor.update({ where: { id: doctor.id }, data: { prescriptionTemplate: ref } });
  revalidatePath(`/${locale}/doctor/prescription`);
}

/** Issued prescriptions keep a frozen copy of their design, so deleting is always safe. */
export async function deleteTemplateAction(localeRaw: string, id: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const doctor = await currentDoctor();
  if (!doctor) return;
  const t = await db.prescriptionTemplate.findFirst({ where: { id, doctorId: doctor.id } });
  if (!t) return;
  await db.$transaction([
    db.prescriptionTemplate.delete({ where: { id } }),
    ...(doctor.prescriptionTemplate === id ? [db.doctor.update({ where: { id: doctor.id }, data: { prescriptionTemplate: null } })] : []),
  ]);
  revalidatePath(`/${locale}/doctor/prescription`);
}
