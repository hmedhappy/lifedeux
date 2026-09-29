import { getCurrentUser } from "@/lib/auth";
import { getConsultationForUser, loadMessages } from "@/lib/consultations";
import { db } from "@/lib/db";
import { saveUploadedImages } from "@/lib/images";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 4000;

async function access(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const found = await getConsultationForUser(id, user);
  return found ? { user, ...found } : null;
}

/** New messages since `after` (ISO date), plus the chat state, for the polling client. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await access(id);
  if (!ctx) return Response.json({ error: "not_found" }, { status: 404 });
  const afterRaw = new URL(request.url).searchParams.get("after");
  const after = afterRaw && !Number.isNaN(Date.parse(afterRaw)) ? new Date(afterRaw) : undefined;
  const messages = await loadMessages(id, ctx.user.id, after);
  return Response.json({ messages, state: ctx.chat }, { headers: { "Cache-Control": "no-store" } });
}

/** Sends a text (JSON { text }) or an image (multipart "image", optional "text"). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await access(id);
  if (!ctx) return Response.json({ error: "not_found" }, { status: 404 });
  if (ctx.chat !== "open") return Response.json({ error: "closed" }, { status: 409 });
  if (!rateLimit(`chat:${ctx.user.id}`, 40, 60_000)) return Response.json({ error: "rate_limited" }, { status: 429 });

  const type = request.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) {
    const form = await request.formData();
    const upload = await saveUploadedImages(form, "image", 1, { private: true, consultationId: id });
    if ("error" in upload) return Response.json({ error: upload.error }, { status: 400 });
    if (upload.paths.length === 0) return Response.json({ error: "empty" }, { status: 400 });
    const imageId = upload.paths[0].split("/").pop()!;
    const caption = String(form.get("text") ?? "").trim().slice(0, MAX_TEXT) || null;
    await db.message.create({ data: { consultationId: id, senderId: ctx.user.id, kind: "IMAGE", imageId, text: caption } });
  } else {
    const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
    if (!text) return Response.json({ error: "empty" }, { status: 400 });
    await db.message.create({ data: { consultationId: id, senderId: ctx.user.id, kind: "TEXT", text } });
  }
  return Response.json({ ok: true }, { status: 201 });
}
