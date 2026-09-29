import { getCurrentUser } from "@/lib/auth";
import { getConsultationForUser } from "@/lib/consultations";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Chat attachments: only the patient and the doctor of the consultation can see them. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const { id, imageId } = await params;
  const user = await getCurrentUser();
  if (!user || !(await getConsultationForUser(id, user))) return new Response("Not found", { status: 404 });
  const image = await db.image.findFirst({ where: { id: imageId, consultationId: id } });
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(image.size),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
