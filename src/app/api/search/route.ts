import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toLocale } from "@/lib/i18n";
import { isDoctorRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Hit = { label: string; sub: string; href: string };

/** Quick search for the ⌘K palette: references and names, scoped to what the user may see. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ results: [] }, { status: 401 });
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const locale = toLocale(url.searchParams.get("locale") ?? "fr");
  if (q.length < 2) return Response.json({ results: [] });
  const text = { contains: q, mode: "insensitive" as const };
  const ref = { startsWith: q.toUpperCase() };
  const results: Hit[] = [];

  if (user.role === "ADMIN") {
    const [bookings, consultations, doctors] = await Promise.all([
      db.booking.findMany({
        where: { OR: [{ reference: ref }, { patient: { OR: [{ firstName: text }, { lastName: text }, { email: text }] } }] },
        include: { patient: true },
        take: 6,
        orderBy: { createdAt: "desc" },
      }),
      db.consultation.findMany({
        where: { OR: [{ reference: ref }, { patient: { OR: [{ firstName: text }, { lastName: text }, { email: text }] } }] },
        include: { patient: true },
        take: 6,
        orderBy: { createdAt: "desc" },
      }),
      db.doctor.findMany({ where: { user: { OR: [{ firstName: text }, { lastName: text }, { email: text }] } }, include: { user: true }, take: 6 }),
    ]);
    for (const d of doctors) results.push({ label: `Dr ${d.user.firstName} ${d.user.lastName}`, sub: d.user.email, href: `/${locale}/admin/doctors/${d.id}` });
    for (const b of bookings) results.push({ label: `${b.patient.firstName} ${b.patient.lastName}`, sub: `${b.reference} · ${b.status}`, href: `/${locale}/admin/bookings/${b.id}` });
    for (const c of consultations)
      results.push({ label: `${c.patient.firstName} ${c.patient.lastName}`, sub: `${c.reference} · ${c.status}`, href: `/${locale}/admin/consultations/${c.id}` });
  } else if (isDoctorRole(user.role)) {
    const doctor = await db.doctor.findUnique({ where: { userId: user.id } });
    if (doctor) {
      const consultations = await db.consultation.findMany({
        where: { doctorId: doctor.id, OR: [{ reference: ref }, { patient: { OR: [{ firstName: text }, { lastName: text }] } }] },
        include: { patient: true, slot: true },
        take: 8,
        orderBy: { slot: { startsAt: "desc" } },
      });
      for (const c of consultations)
        results.push({ label: `${c.patient.firstName} ${c.patient.lastName}`, sub: `${c.reference} · ${c.status}`, href: `/${locale}/doctor/consultations/${c.id}` });
    }
  }
  return Response.json({ results: results.slice(0, 12) });
}
