import "server-only";
import QRCode from "qrcode";
import type { Doctor, PrescriptionTemplate } from "@prisma/client";
import { db } from "./db";
import { imageSize } from "./images";
import { opsToPdf, opsToSvg } from "./rx-render";
import {
  BUILTIN_TEMPLATES,
  DEFAULT_TEMPLATE,
  buildSheet,
  builtinConfig,
  isHexColor,
  type ImageRef,
  type Layout,
  type SheetData,
  type SheetItem,
  type TemplateConfig,
} from "./rx-sheet";
import { appUrl } from "./settings";

export { canonicalContent, contentHash, prescriptionNumber } from "./prescription-hash";

export type PrescriptionFull = NonNullable<Awaited<ReturnType<typeof loadPrescription>>>;

export async function loadPrescription(where: { id: string } | { number: string }) {
  return db.prescription.findUnique({
    where,
    include: {
      items: { orderBy: { position: "asc" } },
      consultation: { select: { reason: true } },
      patient: { select: { firstName: true, lastName: true, country: true, birthDate: true } },
      doctor: { include: { user: { select: { firstName: true, lastName: true, phone: true } }, specialty_: true } },
    },
  });
}

export function verifyUrl(number: string): string {
  return `${appUrl()}/verify/${number}`;
}

/* ------------------------------- Templates ------------------------------- */

export const LAYOUTS: Layout[] = ["teal", "rose", "letterhead"];

function fromRow(t: PrescriptionTemplate): TemplateConfig {
  return {
    layout: LAYOUTS.includes(t.layout as Layout) ? (t.layout as Layout) : "teal",
    color: isHexColor(t.color) ? t.color : "#0f8f7e",
    backgroundImageId: t.backgroundImageId,
    margins: { top: t.marginTop, bottom: t.marginBottom, left: t.marginLeft, right: t.marginRight },
  };
}

/**
 * A template reference is a built-in key, one of the doctor's template ids, or —
 * on issued prescriptions — a frozen JSON copy, so later edits never change a sent document.
 */
export async function resolveTemplate(ref: string | null | undefined, doctorId: string): Promise<TemplateConfig> {
  if (ref?.startsWith("{")) {
    try {
      const t = JSON.parse(ref) as TemplateConfig;
      if (LAYOUTS.includes(t.layout)) return t;
    } catch {
      /* fall through to the default */
    }
  }
  if (ref) {
    const builtin = builtinConfig(ref);
    if (builtin) return builtin;
    const row = await db.prescriptionTemplate.findFirst({ where: { id: ref, doctorId } });
    if (row) return fromRow(row);
  }
  return builtinConfig(DEFAULT_TEMPLATE)!;
}

export type TemplateOption = { ref: string; name: string; layout: Layout; builtin: boolean };

export async function templateOptions(doctorId: string): Promise<TemplateOption[]> {
  const own = await db.prescriptionTemplate.findMany({ where: { doctorId }, orderBy: { createdAt: "asc" } });
  return [
    ...Object.entries(BUILTIN_TEMPLATES).map(([ref, b]) => ({ ref, name: b.name, layout: b.config.layout as Layout, builtin: true })),
    ...own.map((t) => ({ ref: t.id, name: t.name, layout: fromRow(t).layout, builtin: false })),
  ];
}

export function defaultTemplateRef(doctor: Pick<Doctor, "prescriptionTemplate">): string {
  return doctor.prescriptionTemplate ?? DEFAULT_TEMPLATE;
}

/* --------------------------------- Data ---------------------------------- */

type DoctorForSheet = Doctor & { user: { firstName: string; lastName: string; phone: string | null }; specialty_: { nameFr: string } | null };

export function doctorSheet(d: DoctorForSheet): SheetData["doctor"] {
  return {
    name: `Dr ${d.user.firstName} ${d.user.lastName}`,
    title: d.specialty,
    specialty: d.specialty_?.nameFr ?? null,
    license: d.licenseNumber,
    clinic: d.clinicName,
    address: d.clinicAddress,
    city: d.city,
    phone: d.user.phone,
  };
}

function age(birthDate: Date | null, at: Date): number | null {
  if (!birthDate) return null;
  let years = at.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = at.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birthDate.getUTCDate())) years -= 1;
  return years >= 0 && years < 130 ? years : null;
}

export function formatRxDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Tunis" }).format(d);
}

export function sheetData(input: {
  doctor: DoctorForSheet;
  patient: { firstName: string; lastName: string; country: string | null; birthDate: Date | null };
  reason: string | null;
  items: SheetItem[];
  notes: string | null;
  number: string | null;
  issuedAt: Date | null;
  contentHash: string | null;
}): SheetData {
  const at = input.issuedAt ?? new Date();
  return {
    doctor: doctorSheet(input.doctor),
    patient: {
      name: `${input.patient.firstName} ${input.patient.lastName}`,
      age: age(input.patient.birthDate, at),
      country: input.patient.country,
    },
    date: formatRxDate(at),
    number: input.number,
    reason: input.reason,
    items: input.items,
    notes: input.notes,
    verify:
      input.number && input.contentHash
        ? { url: verifyUrl(input.number), fingerprint: input.contentHash.slice(0, 16).toUpperCase() }
        : null,
  };
}

/* -------------------------------- Rendering ------------------------------- */

async function imageRow(id: string | null) {
  return id ? db.image.findUnique({ where: { id } }) : null;
}

/** The certified PDF (drafts get a "preview" watermark and no QR code). */
export async function renderPrescriptionPdf(p: PrescriptionFull): Promise<Uint8Array> {
  const issued = p.status === "ISSUED" && !!p.number && !!p.contentHash;
  const data = sheetData({
    doctor: p.doctor,
    patient: p.patient,
    reason: p.consultation.reason,
    items: p.items,
    notes: p.notes,
    number: issued ? p.number : null,
    issuedAt: p.issuedAt,
    contentHash: issued ? p.contentHash : null,
  });
  const tpl = await resolveTemplate(p.templateRef ?? defaultTemplateRef(p.doctor), p.doctorId);
  const [stamp, signature, background] = await Promise.all([
    imageRow(p.doctor.stampImageId),
    imageRow(p.doctor.signatureImageId),
    tpl.layout === "letterhead" ? imageRow(tpl.backgroundImageId) : null,
  ]);
  const qr = data.verify ? await QRCode.toBuffer(data.verify.url, { margin: 1, width: 240, errorCorrectionLevel: "M" }) : null;
  const bytes = (img: { data: Uint8Array; mime: string } | null) => (img ? { bytes: img.data, mime: img.mime } : null);
  return opsToPdf(
    buildSheet(data, tpl),
    { stamp: bytes(stamp), signature: bytes(signature), background: bytes(background), qr: qr ? { bytes: qr, mime: "image/png" } : null },
    { title: `Ordonnance ${p.number ?? "(aperçu)"}`, author: data.doctor.name },
  );
}

/** Live preview as SVG; private images are referenced through the doctor-only routes. */
export async function renderPreviewSvg(
  data: SheetData,
  tpl: TemplateConfig,
  doctor: Pick<Doctor, "id" | "stampImageId" | "signatureImageId">,
): Promise<string> {
  const refs: [ImageRef, string | null, string][] = [
    ["stamp", doctor.stampImageId, `/api/doctors/${doctor.id}/stamp`],
    ["signature", doctor.signatureImageId, `/api/doctors/${doctor.id}/signature`],
    ["background", tpl.layout === "letterhead" ? tpl.backgroundImageId : null, `/api/doctors/${doctor.id}/letterhead/${tpl.backgroundImageId}`],
  ];
  const hrefs: Partial<Record<ImageRef, { href: string; width: number; height: number }>> = {};
  for (const [ref, id, href] of refs) {
    const row = await imageRow(id);
    const size = row ? imageSize(row.data, row.mime) : null;
    if (row && size) hrefs[ref] = { href, ...size };
  }
  return opsToSvg(buildSheet(data, tpl), hrefs);
}
