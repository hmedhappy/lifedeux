import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { defaultTemplateRef, renderPreviewSvg, resolveTemplate, sheetData } from "@/lib/prescriptions";
import { rateLimit } from "@/lib/rate-limit";
import { isDoctorRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (max: number) => z.string().max(max).default("");
const schema = z.object({
  consultationId: z.string().max(40),
  templateRef: z.string().max(60).nullable().optional(),
  items: z
    .array(z.object({ name: text(200), dosage: text(120), frequency: text(120), duration: text(80), instructions: text(300).nullable().optional() }))
    .max(15),
  notes: text(1500).nullable().optional(),
});

/** Live preview of the prescription being written, as SVG (same layout as the PDF). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isDoctorRole(user.role)) return new Response("Not found", { status: 404 });
  if (!rateLimit(`rx-preview:${user.id}`, 120, 60_000)) return new Response("Too many requests", { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const input = parsed.data;

  const c = await db.consultation.findFirst({
    where: { id: input.consultationId, doctor: { userId: user.id } },
    include: { patient: true, doctor: { include: { user: true, specialty_: true } } },
  });
  if (!c) return new Response("Not found", { status: 404 });

  const tpl = await resolveTemplate(input.templateRef ?? defaultTemplateRef(c.doctor), c.doctorId);
  const data = sheetData({
    doctor: c.doctor,
    patient: c.patient,
    reason: c.reason,
    items: input.items.map((i) => ({ ...i, instructions: i.instructions || null })),
    notes: input.notes || null,
    number: null,
    issuedAt: null,
    contentHash: null,
  });
  const svg = await renderPreviewSvg(data, tpl, c.doctor);
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" } });
}
