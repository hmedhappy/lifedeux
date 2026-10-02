import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Private stamp/signature images (and a stamp waiting for validation): visible to admins and to the doctor they belong to. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  if (kind !== "stamp" && kind !== "signature" && kind !== "pending-stamp") return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  const doctor = user ? await db.doctor.findUnique({ where: { id } }) : null;
  if (!user || !doctor || (user.role !== "ADMIN" && doctor.userId !== user.id)) return new Response("Not found", { status: 404 });
  const imageId = kind === "stamp" ? doctor.stampImageId : kind === "pending-stamp" ? doctor.pendingStampImageId : doctor.signatureImageId;
  const image = imageId ? await db.image.findUnique({ where: { id: imageId } }) : null;
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
