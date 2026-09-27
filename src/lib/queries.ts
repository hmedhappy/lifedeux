import "server-only";
import { db } from "./db";
import { MIN_LEAD_HOURS } from "./constants";

const activeDoctor = { active: true, user: { active: true } } as const;

export async function listActiveOperations() {
  return db.operation.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
}

export async function listPublicDoctors(operationSlug?: string) {
  const doctors = await db.doctor.findMany({
    where: {
      ...activeDoctor,
      operations: operationSlug
        ? { some: { operation: { slug: operationSlug, active: true } } }
        : { some: { operation: { active: true } } },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
      operations: { where: { operation: { active: true } }, select: { price: true } },
      slots: {
        where: { status: "FREE", startsAt: { gt: new Date(Date.now() + MIN_LEAD_HOURS * 60 * 60 * 1000) } },
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { startsAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return doctors.map((d) => ({
    ...d,
    fromPrice: d.operations.length ? Math.min(...d.operations.map((o) => o.price)) : null,
    nextSlot: d.slots[0]?.startsAt ?? null,
  }));
}

export async function getPublicDoctor(id: string) {
  return db.doctor.findFirst({
    where: { id, ...activeDoctor },
    include: {
      user: { select: { firstName: true, lastName: true } },
      operations: { where: { operation: { active: true } }, include: { operation: true } },
      slots: {
        where: { status: "FREE", startsAt: { gt: new Date(Date.now() + MIN_LEAD_HOURS * 60 * 60 * 1000) } },
        orderBy: { startsAt: "asc" },
        take: 120,
      },
    },
  });
}

export async function listActiveStays(minCapacity = 1) {
  return db.accommodation.findMany({
    where: { active: true, capacity: { gte: minCapacity } },
    orderBy: [{ pricePerNight: "asc" }],
  });
}
