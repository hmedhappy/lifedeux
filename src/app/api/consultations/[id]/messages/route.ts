import { getCurrentUser } from "@/lib/auth";
import { PRESENCE_SECONDS, TYPING_SECONDS, chatOpensAt } from "@/lib/consultation-rules";
import { getConsultationForUser, loadMessages, type PeerStatus } from "@/lib/consultations";
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

const recent = (d: Date | null, seconds: number, now: number) => !!d && now - d.getTime() < seconds * 1000;

/**
 * New messages since `after` (ISO date), the chat state and the other side's presence.
 * With `seen=1` (the screen is visible) the viewer's presence is recorded, the other
 * side's messages are marked read, and a first visit posts "… joined".
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await access(id);
  if (!ctx) return Response.json({ error: "not_found" }, { status: 404 });
  const url = new URL(request.url);
  const afterRaw = url.searchParams.get("after");
  const after = afterRaw && !Number.isNaN(Date.parse(afterRaw)) ? new Date(afterRaw) : undefined;
  const c = ctx.consultation;
  const mine = ctx.as === "patient" ? "patientSeenAt" : "doctorSeenAt";

  if (url.searchParams.get("seen") === "1" && ctx.chat === "open") {
    const now = new Date();
    const previous = c[mine];
    if (!previous || previous < chatOpensAt(c.slot.startsAt)) {
      await db.message.create({ data: { consultationId: id, senderId: ctx.user.id, kind: "SYSTEM", text: "joined" } });
    }
    await db.$transaction([
      db.consultation.update({ where: { id }, data: { [mine]: now } }),
      db.message.updateMany({ where: { consultationId: id, senderId: { not: ctx.user.id }, readAt: null }, data: { readAt: now } }),
    ]);
  }

  const now = Date.now();
  const peerSeen = ctx.as === "patient" ? c.doctorSeenAt : c.patientSeenAt;
  const peerTyping = ctx.as === "patient" ? c.doctorTypingAt : c.patientTypingAt;
  const peer: PeerStatus = {
    online: recent(peerSeen, PRESENCE_SECONDS, now),
    typing: ctx.chat === "open" && recent(peerTyping, TYPING_SECONDS, now),
    seenAt: peerSeen?.toISOString() ?? null,
  };
  const messages = await loadMessages(id, ctx.user.id, after);
  return Response.json({ messages, state: ctx.chat, peer }, { headers: { "Cache-Control": "no-store" } });
}

/** Sends a text (JSON { text }) or an image (multipart "image", optional "text"). JSON { typing: true } only signals typing. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await access(id);
  if (!ctx) return Response.json({ error: "not_found" }, { status: 404 });
  if (ctx.chat !== "open") return Response.json({ error: "closed" }, { status: 409 });
  if (!rateLimit(`chat:${ctx.user.id}`, 60, 60_000)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const typingField = ctx.as === "patient" ? "patientTypingAt" : "doctorTypingAt";

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
    const body = (await request.json().catch(() => null)) as { text?: unknown; typing?: unknown } | null;
    if (body?.typing === true) {
      await db.consultation.update({ where: { id }, data: { [typingField]: new Date() } });
      return Response.json({ ok: true });
    }
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
    if (!text) return Response.json({ error: "empty" }, { status: 400 });
    await db.message.create({ data: { consultationId: id, senderId: ctx.user.id, kind: "TEXT", text } });
  }
  await db.consultation.update({ where: { id }, data: { [typingField]: null } });
  return Response.json({ ok: true }, { status: 201 });
}
