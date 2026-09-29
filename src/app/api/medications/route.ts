import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchMedications } from "@/lib/medications";
import { isDoctorRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Medication autocomplete for doctors writing a prescription. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (!isDoctorRole(user.role) && user.role !== "ADMIN")) return Response.json({ error: "forbidden" }, { status: 403 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const doctor = isDoctorRole(user.role) ? await db.doctor.findUnique({ where: { userId: user.id }, select: { specialtyId: true } }) : null;
  const results = await searchMedications(q, { specialtyId: doctor?.specialtyId });
  return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
