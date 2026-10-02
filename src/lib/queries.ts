import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { MIN_LEAD_HOURS } from "./constants";
import { CONSULT_MIN_LEAD_HOURS } from "./consultation-rules";
import { specialtiesForSymptom } from "./symptoms";

/** Publicly listed doctors: active accounts; referred doctors only once the admin has verified them. */
const activeDoctor = {
  active: true,
  user: { active: true },
  NOT: { referredById: { not: null }, verifiedAt: null },
} satisfies Prisma.DoctorWhereInput;

/** Share of the consultation price owed to the doctor when the admin set no explicit fee. */
export const DEFAULT_CONSULTATION_FEE_RATIO = 0.7;

/** Effective online-consultation offer of a doctor, or null when they do not consult online. */
export function consultationOffer(doctor: {
  offersConsultation: boolean;
  consultationPrice: number | null;
  consultationFee: number | null;
  specialty_?: { consultationPrice: number } | null;
}): { price: number; fee: number } | null {
  if (!doctor.offersConsultation) return null;
  const price = doctor.consultationPrice ?? doctor.specialty_?.consultationPrice;
  if (!price) return null;
  return { price, fee: doctor.consultationFee ?? Math.round(price * DEFAULT_CONSULTATION_FEE_RATIO) };
}

export async function listActiveOperations() {
  return db.operation.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
}

/** Active specialties with the number of active doctors in each. */
export async function listSpecialties() {
  const specialties = await db.specialty.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { nameFr: "asc" }],
    include: { _count: { select: { doctors: { where: activeDoctor } } } },
  });
  return specialties.map(({ _count, ...s }) => ({ ...s, doctorCount: _count.doctors }));
}

export async function listPublicDoctors(
  filters: { specialtySlug?: string; q?: string; operationSlug?: string; surgeryOnly?: boolean } = {},
) {
  const q = filters.q?.trim();
  const symptomSlugs = q ? specialtiesForSymptom(q) : [];
  const where: Prisma.DoctorWhereInput = {
    ...activeDoctor,
    ...(filters.specialtySlug ? { specialty_: { slug: filters.specialtySlug, active: true } } : {}),
    ...(filters.operationSlug ? { operations: { some: { operation: { slug: filters.operationSlug, active: true } } } } : {}),
    ...(filters.surgeryOnly && !filters.operationSlug ? { operations: { some: { operation: { active: true } } } } : {}),
    ...(q
      ? {
          OR: [
            { user: { firstName: { contains: q, mode: "insensitive" } } },
            { user: { lastName: { contains: q, mode: "insensitive" } } },
            { specialty: { contains: q, mode: "insensitive" } },
            { clinicName: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { specialty_: { nameFr: { contains: q, mode: "insensitive" } } },
            { specialty_: { nameEn: { contains: q, mode: "insensitive" } } },
            { specialty_: { nameAr: { contains: q } } },
            ...(symptomSlugs.length ? [{ specialty_: { slug: { in: symptomSlugs } } }] : []),
          ],
        }
      : {}),
  };
  const doctors = await db.doctor.findMany({
    where,
    include: {
      user: { select: { firstName: true, lastName: true } },
      specialty_: true,
      operations: { where: { operation: { active: true } }, select: { price: true } },
      slots: {
        where: { status: "FREE", startsAt: { gt: new Date(Date.now() + CONSULT_MIN_LEAD_HOURS * 3_600_000) } },
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { startsAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 60,
  });
  const ratings = await doctorRatings(doctors.map((d) => d.id));
  return doctors
    .map((d) => ({
      ...d,
      fromPrice: d.operations.length ? Math.min(...d.operations.map((o) => o.price)) : null,
      consultation: consultationOffer(d),
      nextSlot: d.slots[0]?.startsAt ?? null,
      rating: ratings.get(d.id) ?? null,
    }))
    // Soonest availability first; doctors without a free slot go last.
    .sort((a, b) => (a.nextSlot?.getTime() ?? Infinity) - (b.nextSlot?.getTime() ?? Infinity));
}

/** Average rating and number of visible reviews per doctor. */
export async function doctorRatings(doctorIds: string[]) {
  const rows = doctorIds.length
    ? await db.review.groupBy({ by: ["doctorId"], where: { doctorId: { in: doctorIds }, hidden: false }, _avg: { rating: true }, _count: true })
    : [];
  return new Map(rows.map((r) => [r.doctorId, { average: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count }]));
}

export async function getPublicDoctor(id: string) {
  const doctor = await db.doctor.findFirst({
    where: { id, ...activeDoctor },
    include: {
      user: { select: { firstName: true, lastName: true } },
      specialty_: true,
      operations: { where: { operation: { active: true } }, include: { operation: true } },
    },
  });
  if (!doctor) return null;
  const [operationSlots, consultationSlots] = await Promise.all([
    db.slot.findMany({
      where: { doctorId: id, kind: "OPERATION", status: "FREE", startsAt: { gt: new Date(Date.now() + MIN_LEAD_HOURS * 3_600_000) } },
      orderBy: { startsAt: "asc" },
      take: 120,
    }),
    db.slot.findMany({
      where: { doctorId: id, kind: "CONSULTATION", status: "FREE", startsAt: { gt: new Date(Date.now() + CONSULT_MIN_LEAD_HOURS * 3_600_000) } },
      orderBy: { startsAt: "asc" },
      take: 200,
    }),
  ]);
  const [ratings, reviews] = await Promise.all([
    doctorRatings([id]),
    db.review.findMany({
      where: { doctorId: id, hidden: false },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  return {
    ...doctor,
    operationSlots,
    consultationSlots,
    consultation: consultationOffer(doctor),
    rating: ratings.get(id) ?? null,
    reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, text: r.text, createdAt: r.createdAt, author: `${r.patient.firstName} ${r.patient.lastName.charAt(0)}.` })),
  };
}

export async function listActiveStays(minCapacity = 1) {
  return db.accommodation.findMany({
    where: { active: true, capacity: { gte: minCapacity } },
    orderBy: [{ pricePerNight: "asc" }],
  });
}
