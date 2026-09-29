import { getCurrentUser } from "@/lib/auth";
import { loadPrescription, renderPrescriptionPdf } from "@/lib/prescriptions";
import { isDoctorRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The patient downloads issued prescriptions; the doctor can also preview drafts. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const p = user ? await loadPrescription({ id }) : null;
  if (!user || !p) return new Response("Not found", { status: 404 });
  const isDoctor = isDoctorRole(user.role) && p.doctor.userId === user.id;
  const isPatient = p.patientId === user.id && p.status === "ISSUED";
  if (!isDoctor && !isPatient) return new Response("Not found", { status: 404 });

  const bytes = await renderPrescriptionPdf(p);
  const name = p.number ? `ordonnance-${p.number}.pdf` : "ordonnance-apercu.pdf";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
