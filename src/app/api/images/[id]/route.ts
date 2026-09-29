import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]+$/.test(id)) return new Response("Not found", { status: 404 });
  const image = await db.image.findUnique({ where: { id } });
  // Chat attachments, stamps and signatures are only served through authenticated routes.
  if (!image || image.private) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(image.size),
      // Images are never modified: a new upload gets a new id.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
