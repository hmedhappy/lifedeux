import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** A doctor's letterhead background (private): visible to that doctor and to admins. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const { id, imageId } = await params;
  const user = await getCurrentUser();
  const doctor = user ? await db.doctor.findUnique({ where: { id } }) : null;
  if (!user || !doctor || (user.role !== "ADMIN" && doctor.userId !== user.id)) return new Response("Not found", { status: 404 });
  const owned = await db.prescriptionTemplate.findFirst({ where: { doctorId: id, backgroundImageId: imageId } });
  const image = owned ? await db.image.findUnique({ where: { id: imageId } }) : null;
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
