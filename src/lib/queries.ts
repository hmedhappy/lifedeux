import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { MIN_LEAD_HOURS } from "./constants";
import { CONSULT_MIN_LEAD_HOURS, IN_PERSON_MIN_LEAD_MINUTES } from "./consultation-rules";
import { specialtiesForSymptom } from "./symptoms";
import { cityCentre } from "./cities";

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
  /** A validated stamp is required: prescriptions cannot be signed without it. */
  stampImageId: string | null;
  consultationPrice: number | null;
  consultationFee: number | null;
  specialty_?: { consultationPrice: number } | null;
}): { price: number; fee: number } | null {
  if (!doctor.offersConsultation || !doctor.stampImageId) return null;
  const price = doctor.consultationPrice ?? doctor.specialty_?.consultationPrice;
  if (!price) return null;
  return { price, fee: doctor.consultationFee ?? Math.round(price * DEFAULT_CONSULTATION_FEE_RATIO) };
}

/** Consultation at the practice, paid there: only needs a price and an address. */
export function inPersonOffer(doctor: { offersInPerson: boolean; inPersonPrice: number | null; clinicAddress: string }): { price: number } | null {
  if (!doctor.offersInPerson || !doctor.inPersonPrice || !doctor.clinicAddress) return null;
  return { price: doctor.inPersonPrice };
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

export type DoctorSort = "soon" | "rating" | "near";

/** Distance in km between two points (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Km to the practice: its pin on the map, or else the centre of its city. */
function practiceDistance(from: { lat: number; lng: number }, d: { clinicLat: number | null; clinicLng: number | null; city: string }): number | null {
  const at = d.clinicLat !== null && d.clinicLng !== null ? { lat: d.clinicLat, lng: d.clinicLng } : cityCentre(d.city);
  return at ? distanceKm(from, at) : null;
}

export async function listPublicDoctors(
  filters: {
    specialtySlug?: string;
    q?: string;
    operationSlug?: string;
    surgeryOnly?: boolean;
    /** Only doctors seeing patients at their practice, or consulting online. */
    mode?: "cabinet" | "online";
    sort?: DoctorSort;
    /** The patient's position, for "near me" (rounded by the client). */
    near?: { lat: number; lng: number } | null;
  } = {},
) {
  const q = filters.q?.trim();
  const symptomSlugs = q ? specialtiesForSymptom(q) : [];
  const where: Prisma.DoctorWhereInput = {
    ...activeDoctor,
    ...(filters.specialtySlug ? { specialty_: { slug: filters.specialtySlug, active: true } } : {}),
    ...(filters.operationSlug ? { operations: { some: { operation: { slug: filters.operationSlug, active: true } } } } : {}),
    ...(filters.surgeryOnly && !filters.operationSlug ? { operations: { some: { operation: { active: true } } } } : {}),
    ...(filters.mode === "cabinet" ? { offersInPerson: true, inPersonPrice: { not: null }, NOT: { clinicAddress: "" } } : {}),
    ...(filters.mode === "online" ? { offersConsultation: true, stampImageId: { not: null } } : {}),
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
      inPerson: inPersonOffer(d),
      nextSlot: d.slots[0]?.startsAt ?? null,
      rating: ratings.get(d.id) ?? null,
      distance: filters.near ? practiceDistance(filters.near, d) : null,
    }))
    .sort((a, b) => {
      const at = (d: typeof a) => d.nextSlot?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const soon = at(a) - at(b);
      // Best rated: average, then number of reviews; unrated doctors after.
      if (filters.sort === "rating") return (b.rating?.average ?? 0) - (a.rating?.average ?? 0) || (b.rating?.count ?? 0) - (a.rating?.count ?? 0) || soon;
      // Nearest practice first; doctors without a known position after.
      if (filters.sort === "near") return (a.distance ?? 1e9) - (b.distance ?? 1e9) || soon;
      // Soonest availability first; doctors without a free slot go last.
      return soon;
    });
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
    // One agenda for both: the practice accepts shorter notice than online.
    db.slot.findMany({
      where: { doctorId: id, kind: "CONSULTATION", status: "FREE", startsAt: { gt: new Date(Date.now() + IN_PERSON_MIN_LEAD_MINUTES * 60_000) } },
      orderBy: { startsAt: "asc" },
      take: 200,
    }),
  ]);
  const onlineFrom = Date.now() + CONSULT_MIN_LEAD_HOURS * 3_600_000;
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
    consultationSlots: consultationSlots.filter((s) => s.startsAt.getTime() > onlineFrom),
    inPersonSlots: consultationSlots,
    consultation: consultationOffer(doctor),
    inPerson: inPersonOffer(doctor),
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

/**
 * Surgery catalogue: each active procedure with the surgeons offering it (price,
 * rating, next free date), cheapest first. docs/RELOOKING.md §8 ("l'opération d'abord").
 */
export async function surgeryCatalogue() {
  const operations = await db.operation.findMany({
    where: { active: true },
    include: {
      specialty: true,
      doctors: { where: { doctor: activeDoctor }, include: { doctor: { include: { user: true } } } },
    },
    orderBy: { basePrice: "asc" },
  });
  const doctorIds = [...new Set(operations.flatMap((o) => o.doctors.map((d) => d.doctorId)))];
  const [ratings, next] = await Promise.all([
    doctorRatings(doctorIds),
    db.slot.groupBy({
      by: ["doctorId"],
      where: { doctorId: { in: doctorIds }, kind: "OPERATION", status: "FREE", startsAt: { gt: new Date() } },
      _min: { startsAt: true },
    }),
  ]);
  const nextSlot = new Map(next.map((n) => [n.doctorId, n._min.startsAt]));
  return operations
    .filter((o) => o.doctors.length > 0)
    .map((o) => ({
      ...o,
      surgeons: o.doctors
        .map((d) => ({
          id: d.doctorId,
          name: `Dr ${d.doctor.user.firstName} ${d.doctor.user.lastName}`,
          photoUrl: d.doctor.photoUrl,
          city: d.doctor.city,
          clinic: d.doctor.clinicName,
          years: d.doctor.yearsOfExperience,
          price: d.price,
          rating: ratings.get(d.doctorId) ?? null,
          nextSlot: nextSlot.get(d.doctorId) ?? null,
        }))
        .sort((a, b) => a.price - b.price),
    }));
}
