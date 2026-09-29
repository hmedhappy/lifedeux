import type { PrismaClient } from "@prisma/client";
import { MEDICATIONS, OPERATIONS, SPECIALTIES, medicationSearchText } from "../data/reference";

/**
 * Specialties, procedures and example medications. Idempotent: existing rows
 * keep the values an admin may have edited; only missing rows are created.
 */
export async function seedReference(db: PrismaClient) {
  for (const [i, s] of SPECIALTIES.entries()) {
    await db.specialty.upsert({
      where: { slug: s.slug },
      update: {},
      create: { slug: s.slug, nameFr: s.fr, nameEn: s.en, nameAr: s.ar, icon: s.icon, consultationPrice: s.price, sortOrder: i },
    });
  }
  const specialtyId = new Map((await db.specialty.findMany({ select: { id: true, slug: true } })).map((s) => [s.slug, s.id]));

  for (const o of OPERATIONS) {
    const data = {
      nameFr: o.fr,
      nameEn: o.en,
      nameAr: o.ar,
      descriptionFr: o.descFr,
      descriptionEn: o.descEn,
      descriptionAr: o.descAr,
      basePrice: o.price,
      defaultRecoveryNights: o.recovery,
      specialtyId: specialtyId.get(o.specialty) ?? null,
    };
    const existing = await db.operation.findUnique({ where: { slug: o.slug } });
    if (!existing) await db.operation.create({ data: { slug: o.slug, ...data } });
    else if (!existing.specialtyId) await db.operation.update({ where: { id: existing.id }, data: { specialtyId: data.specialtyId } });
  }

  for (const m of MEDICATIONS) {
    await db.medication.upsert({
      where: { name_strength_form: { name: m.name, strength: m.strength, form: m.form } },
      update: {},
      create: {
        name: m.name,
        dci: m.dci,
        form: m.form,
        strength: m.strength,
        searchText: medicationSearchText(m),
        specialtyId: m.specialty ? specialtyId.get(m.specialty) ?? null : null,
      },
    });
  }

  return {
    specialties: await db.specialty.count(),
    operations: await db.operation.count(),
    medications: await db.medication.count(),
  };
}
