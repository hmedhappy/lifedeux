/**
 * Prescription page layout, shared by the PDF and the live preview.
 *
 * `buildSheet` turns the prescription data and a template into a list of drawing
 * operations in A4 points (origin top-left). `rx-render.ts` draws those operations
 * either with pdf-lib (the certified PDF) or as SVG (the preview in the browser), so
 * what the doctor previews is exactly what the patient receives.
 */
import { StandardFontEmbedder, StandardFonts } from "pdf-lib";

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
const MM = 2.8346;

export type Layout = "teal" | "rose" | "letterhead";

export type TemplateConfig = {
  layout: Layout;
  color: string;
  backgroundImageId: string | null;
  /** Letterhead only: blank space kept around the content, in millimetres. */
  margins: { top: number; bottom: number; left: number; right: number };
};

export type SheetItem = { name: string; dosage: string; frequency: string; duration: string; instructions: string | null };

export type SheetData = {
  doctor: {
    name: string;
    title: string;
    specialty: string | null;
    license: string | null;
    clinic: string;
    address: string;
    city: string;
    phone: string | null;
  };
  patient: { name: string; age: number | null; country: string | null };
  date: string;
  number: string | null;
  reason: string | null;
  items: SheetItem[];
  notes: string | null;
  /** Set once issued; a draft gets a "preview" watermark instead of the QR code. */
  verify: { url: string; fingerprint: string } | null;
};

/** `logo` is the white Medelys logo, supplied by the renderer callers rather than the doctor. */
export type ImageRef = "stamp" | "signature" | "qr" | "background" | "logo";
export type Font = "r" | "b" | "i";

export type Op =
  | { t: "rect"; x: number; y: number; w: number; h: number; fill: string; opacity?: number }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { t: "circle"; cx: number; cy: number; r: number; fill: string }
  | { t: "text"; x: number; y: number; s: string; size: number; font: Font; color: string; spacing?: number; opacity?: number; rotate?: number }
  /** SVG path drawn in its own units, placed at (x, y) and scaled; the stroke width is in path units. */
  | { t: "path"; d: string; x: number; y: number; scale: number; color: string; width: number; opacity?: number }
  | { t: "image"; ref: ImageRef; x: number; y: number; w: number; h: number; fit: "contain" | "fill"; align?: "left" | "center" }
  /** Placeholder shown where an image is missing (e.g. the QR code of a draft). */
  | { t: "box"; x: number; y: number; w: number; h: number; color: string };

export const BUILTIN_TEMPLATES = {
  "builtin:teal": { name: "Turquoise", config: { layout: "teal", color: "#0f8f7e" } },
  "builtin:rose": { name: "Medelys", config: { layout: "rose", color: "#014d7d" } },
} as const;
export type BuiltinRef = keyof typeof BUILTIN_TEMPLATES;
export const DEFAULT_TEMPLATE: BuiltinRef = "builtin:teal";

const NO_MARGINS = { top: 45, bottom: 30, left: 18, right: 18 };
export function builtinConfig(ref: string): TemplateConfig | null {
  const b = BUILTIN_TEMPLATES[ref as BuiltinRef];
  return b ? { ...b.config, backgroundImageId: null, margins: NO_MARGINS } : null;
}

/* ------------------------------ Text helpers ------------------------------ */

const fonts = {
  r: StandardFontEmbedder.for(StandardFonts.Helvetica as never),
  b: StandardFontEmbedder.for(StandardFonts.HelveticaBold as never),
  i: StandardFontEmbedder.for(StandardFonts.HelveticaOblique as never),
};

const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** The standard PDF fonts only cover Latin-1; other characters become "?". */
export function safe(text: string): string {
  return [...text.normalize("NFC")]
    .map((c) => {
      const code = c.codePointAt(0)!;
      if (c === "\n" || c === "\t" || c === "\r") return " ";
      return (code >= 32 && code < 127) || (code >= 160 && code < 256) || WIN_ANSI_EXTRA.has(c) ? c : "?";
    })
    .join("");
}

export function textWidth(s: string, size: number, font: Font = "r", spacing = 0): number {
  const clean = safe(s);
  return fonts[font].widthOfTextAtSize(clean, size) + spacing * Math.max(0, clean.length - 1);
}

function wrap(text: string, size: number, font: Font, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of safe(paragraph).split(" ").filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, size, font) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Largest size (down to `min`) at which the text fits in `width`. */
function fit(s: string, size: number, font: Font, width: number, min = 7, spacing = 0): number {
  let v = size;
  while (v > min && textWidth(s, v, font, spacing) > width) v -= 0.5;
  return v;
}

function hex(color: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  const n = m ? parseInt(m[1], 16) : 0x0f8f7e;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}
export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

const INK = "#222222";
const MUTED = "#6b6b6b";
const NAVY = "#1e3a5f";
const WHITE = "#ffffff";

/** Stethoscope whose tube draws a heart, in a 100 × 100 box. */
export const STETHOSCOPE_HEART =
  "M22 6 C18 26 22 40 34 46 M46 6 C50 26 46 40 34 46 M34 46 C34 58 40 66 48 74 C52 78 56 82 58 86 " +
  "C60 82 64 78 68 74 C76 66 78 56 70 52 C64 49 60 54 58 60 C56 54 52 49 46 52 C40 55 42 64 48 74 " +
  "M68 74 C74 64 80 50 80 40 M90 30 A10 10 0 1 1 70 30 A10 10 0 1 1 90 30";
const PHONE =
  "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3" +
  "a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7" +
  "A2 2 0 0 1 22 16.92z";

/* --------------------------------- Pieces --------------------------------- */

class Page {
  ops: Op[] = [];
  text(s: string, x: number, y: number, size: number, font: Font = "r", color = INK, extra: { spacing?: number; opacity?: number; rotate?: number } = {}) {
    if (s) this.ops.push({ t: "text", x, y, s: safe(s), size, font, color, ...extra });
  }
  right(s: string, xRight: number, y: number, size: number, font: Font = "r", color = INK, spacing = 0) {
    this.text(s, xRight - textWidth(s, size, font, spacing), y, size, font, color, { spacing });
  }
  center(s: string, cx: number, y: number, size: number, font: Font = "r", color = INK) {
    this.text(s, cx - textWidth(s, size, font) / 2, y, size, font, color);
  }
  /** Wrapped paragraph; returns the y after the last line. */
  para(s: string, x: number, y: number, width: number, size: number, font: Font, color: string, leading: number, maxY = PAGE_H) {
    for (const line of wrap(s, size, font, width)) {
      if (y > maxY) break;
      this.text(line, x, y, size, font, color);
      y += leading;
    }
    return y;
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string, width = 0.8) {
    this.ops.push({ t: "line", x1, y1, x2, y2, color, width });
  }
  rect(x: number, y: number, w: number, h: number, fill: string, opacity?: number) {
    this.ops.push({ t: "rect", x, y, w, h, fill, opacity });
  }
  push(op: Op) {
    this.ops.push(op);
  }
}

function drawItems(pg: Page, data: SheetData, x: number, y: number, width: number, maxY: number, color: string): number {
  data.items.forEach((item, index) => {
    if (y > maxY) return;
    pg.text(`${index + 1}.`, x, y, 11.5, "b", color);
    const nameLines = wrap(item.name || "…", 11.5, "b", width - 20);
    nameLines.forEach((l, i) => pg.text(l, x + 20, y + i * 14.5, 11.5, "b", INK));
    y += nameLines.length * 14.5;
    const detail = [item.dosage, item.frequency, item.duration ? `pendant ${item.duration}` : ""].filter(Boolean).join(" — ");
    y = pg.para(detail, x + 20, y, width - 20, 10, "r", INK, 13.5, maxY);
    if (item.instructions) y = pg.para(item.instructions, x + 20, y, width - 20, 9.5, "i", MUTED, 12.5, maxY);
    y += 10;
  });
  if (data.notes && y <= maxY) {
    y += 4;
    pg.text("Remarques :", x, y, 10, "b", INK);
    y = pg.para(data.notes, x, y + 14, width, 9.5, "r", INK, 12.5, maxY);
  }
  return y;
}

function signatureBlock(pg: Page, xRight: number, top: number) {
  pg.right("Cachet et signature du médecin", xRight, top, 8.5, "r", MUTED);
  pg.push({ t: "image", ref: "stamp", x: xRight - 170, y: top + 8, w: 105, h: 105, fit: "contain", align: "left" });
  pg.push({ t: "image", ref: "signature", x: xRight - 100, y: top + 42, w: 100, h: 55, fit: "contain", align: "center" });
}

function draftWatermark(pg: Page, x: number, y: number, color: string) {
  pg.text("APERÇU — NON VALABLE", x, y, 32, "b", color, { opacity: 0.16, rotate: 35 });
}

function verifyLines(data: SheetData) {
  if (!data.verify) return null;
  return {
    head: "Ordonnance vérifiable : scannez le QR code ou ouvrez",
    url: data.verify.url,
    fingerprint: `Empreinte : ${data.verify.fingerprint}`,
  };
}

/* --------------------------------- Layouts -------------------------------- */

function teal(data: SheetData, color: string): Op[] {
  const pg = new Page();
  const W = PAGE_W;
  const H = PAGE_H;
  const M = 40;
  const dark = mix(color, NAVY, 0.45);

  // Header: doctor on the left, clinic on the right, stethoscope in the middle.
  const nameSize = fit(data.doctor.name, 22, "b", 235, 14);
  pg.text(data.doctor.name, M, 64, nameSize, "b", color);
  const title = data.doctor.title.toUpperCase();
  pg.text(title, M, 84, fit(title, 10, "r", 235, 6.5, 1.6), "r", NAVY, { spacing: 1.6 });
  let hy = 100;
  for (const line of [data.doctor.specialty, data.doctor.license ? `N° d'inscription à l'Ordre : ${data.doctor.license}` : null]) {
    if (!line) continue;
    pg.text(line, M, hy, 8.5, "r", MUTED);
    hy += 11;
  }
  pg.push({ t: "path", d: STETHOSCOPE_HEART, x: 268, y: 40, scale: 0.5, color, width: 3 });
  const clinic = data.doctor.clinic.toUpperCase();
  pg.right(clinic, W - M, 64, fit(clinic, 14, "r", 220, 9), "r", NAVY);
  if (data.doctor.specialty) pg.right(data.doctor.specialty.toUpperCase(), W - M, 78, 8.5, "r", NAVY);
  hy = 94;
  for (const line of wrap(`${data.doctor.address}, ${data.doctor.city}`, 8.5, "r", 210)) {
    pg.right(line, W - M, hy, 8.5, "r", MUTED);
    hy += 11;
  }

  // Patient / age / date band.
  const bandTop = 150;
  const bandBottom = 174;
  pg.line(0, bandTop, W, bandTop, NAVY, 1.1);
  pg.line(0, bandBottom, W, bandBottom, NAVY, 1.1);
  pg.line(372, bandTop, 372, bandBottom, NAVY, 1.1);
  pg.line(452, bandTop, 452, bandBottom, NAVY, 1.1);
  pg.text("Patient :", M, 166, 9, "b", color);
  const who = data.patient.name + (data.patient.country ? ` (${data.patient.country})` : "");
  pg.text(who, M + 44, 166, fit(who, 10, "r", 280, 7), "r", INK);
  pg.text("Âge :", 380, 166, 9, "b", color);
  pg.text(data.patient.age != null ? `${data.patient.age} ans` : "—", 404, 166, 10, "r", INK);
  pg.text("Date :", 460, 166, 9, "b", color);
  pg.text(data.date, 488, 166, fit(data.date, 10, "r", W - 494, 6.5), "r", INK);

  // Left column: reason and reference.
  const footerTop = H - 90;
  const colX = 150;
  pg.line(colX, bandBottom, colX, footerTop, NAVY, 1.1);
  pg.text("C/C", M + 12, 232, 13, "r", color);
  let ly = 250;
  if (data.reason) ly = pg.para(data.reason, M + 12, ly, colX - M - 22, 8.5, "r", MUTED, 11, 430);
  pg.text("N°", M + 12, Math.max(ly + 30, 470), 13, "r", color);
  pg.line(M + 12, Math.max(ly + 30, 470) + 5, M + 40, Math.max(ly + 30, 470) + 5, color, 0.8);
  const ref = data.number ?? "APERÇU";
  pg.text(ref, M + 12, Math.max(ly + 30, 470) + 20, fit(ref, 8.5, "r", colX - M - 20, 5.5), "r", MUTED);

  // Main column: Rx, faint stethoscope, the medicines.
  const mx = colX + 20;
  pg.text("R", mx, 226, 26, "b", color);
  pg.text("x", mx + textWidth("R", 26, "b") - 4, 234, 16, "b", color);
  pg.push({ t: "path", d: STETHOSCOPE_HEART, x: mx + 20, y: 250, scale: 3.6, color, width: 1.1, opacity: 0.12 });
  drawItems(pg, data, mx, 268, W - M - mx, 585, color);

  signatureBlock(pg, W - M, 600);

  const v = verifyLines(data);
  if (v) {
    pg.text(v.head, mx, 726, 7, "r", MUTED);
    pg.text(v.url, mx, 736, fit(v.url, 7.5, "r", W - M - mx, 5.5), "r", INK);
    pg.text(v.fingerprint, mx, 746, 7, "r", MUTED);
  } else draftWatermark(pg, mx + 10, 560, color);

  // Footer band, drawn as thin strips to give a gradient in both renderers.
  const strips = 40;
  for (let i = 0; i < strips; i++) {
    pg.rect((W / strips) * i, footerTop, W / strips + 0.6, H - footerTop, mix(mix(color, "#2bb673", 0.35), dark, i / (strips - 1)));
  }
  pg.rect(M + 22, footerTop + 8, 76, 76, WHITE);
  if (data.verify) pg.push({ t: "image", ref: "qr", x: M + 26, y: footerTop + 12, w: 68, h: 68, fit: "contain", align: "center" });
  else pg.center("QR", M + 60, footerTop + 53, 18, "b", NAVY);
  pg.text("Adresse :", 160, footerTop + 30, 9, "b", WHITE);
  pg.para(`${data.doctor.clinic} — ${data.doctor.address}, ${data.doctor.city}`, 160, footerTop + 44, 220, 8, "r", WHITE, 10.5, H - 8);
  if (data.doctor.phone) {
    pg.push({ t: "circle", cx: 425, cy: footerTop + 42, r: 11, fill: WHITE });
    pg.push({ t: "path", d: PHONE, x: 418, y: footerTop + 35, scale: 0.58, color: dark, width: 2.4 });
    pg.text("Appelez", 444, footerTop + 38, 8.5, "r", WHITE);
    pg.text(data.doctor.phone, 444, footerTop + 52, fit(data.doctor.phone, 12, "b", W - M - 444, 7), "b", WHITE);
  }
  return pg.ops;
}

function rose(data: SheetData, color: string): Op[] {
  const pg = new Page();
  const W = PAGE_W;
  const M = 48;
  pg.rect(0, 0, W, 92, color);
  pg.push({ t: "image", ref: "logo", x: M, y: 26, w: 120, h: 27, fit: "contain", align: "left" });
  pg.text("Téléconsultation", M, 70, 10, "r", WHITE);
  pg.right("ORDONNANCE MÉDICALE", W - M, 50, 16, "b", WHITE);
  pg.right("Medical prescription", W - M, 66, 10, "r", WHITE);

  let y = 130;
  pg.text(data.doctor.name, M, y, fit(data.doctor.name, 14, "b", 300, 10), "b", INK);
  y += 16;
  pg.text(data.doctor.specialty ? `${data.doctor.specialty} — ${data.doctor.title}` : data.doctor.title, M, y, 10, "r", MUTED);
  if (data.doctor.license) pg.text(`N° d'inscription à l'Ordre : ${data.doctor.license}`, M, (y += 14), 10, "r", MUTED);
  pg.text(`${data.doctor.clinic} — ${data.doctor.address}, ${data.doctor.city}`, M, (y += 14), 10, "r", MUTED);
  if (data.doctor.phone) pg.text(`Tél. ${data.doctor.phone}`, M, (y += 14), 10, "r", MUTED);
  pg.right(`Le ${data.date}`, W - M, 130, 10, "b", INK);
  pg.right(`N° ${data.number ?? "APERÇU"}`, W - M, 146, 10, "r", INK);

  y += 30;
  pg.line(M, y - 12, W - M, y - 12, "#dddddd", 0.7);
  pg.text("Patient :", M, y + 4, 11, "b", INK);
  const who = `${data.patient.name}${data.patient.age != null ? `, ${data.patient.age} ans` : ""}${data.patient.country ? ` (${data.patient.country})` : ""}`;
  pg.text(who, M + 58, y + 4, 11, "r", INK);
  drawItems(pg, data, M, y + 38, W - 2 * M, 600, color);

  signatureBlock(pg, W - M, 650);
  const v = verifyLines(data);
  if (v) {
    pg.push({ t: "image", ref: "qr", x: M, y: 676, w: 96, h: 96, fit: "contain", align: "left" });
    pg.text("Ordonnance vérifiable", M + 106, 692, 10, "b", INK);
    pg.text("Scannez le QR code ou ouvrez :", M + 106, 708, 8.5, "r", MUTED);
    pg.text(v.url, M + 106, 720, fit(v.url, 8, "r", W - M - 175 - (M + 106), 5.5), "r", INK);
    pg.text(v.fingerprint, M + 106, 752, 8.5, "r", MUTED);
  } else draftWatermark(pg, 120, 560, color);

  pg.line(M, PAGE_H - 50, W - M, PAGE_H - 50, "#dddddd", 0.5);
  pg.text("Document émis via Medelys à la suite d'une téléconsultation. Valable après vérification.", M, PAGE_H - 36, 8, "r", MUTED);
  return pg.ops;
}

function letterhead(data: SheetData, tpl: TemplateConfig): Op[] {
  const pg = new Page();
  const color = tpl.color;
  const L = tpl.margins.left * MM;
  const R = PAGE_W - tpl.margins.right * MM;
  const T = tpl.margins.top * MM;
  const B = PAGE_H - tpl.margins.bottom * MM;
  if (tpl.backgroundImageId) pg.push({ t: "image", ref: "background", x: 0, y: 0, w: PAGE_W, h: PAGE_H, fit: "fill" });
  else pg.push({ t: "box", x: L, y: T, w: R - L, h: B - T, color: "#cccccc" });

  let y = T + 14;
  pg.text("Patient :", L, y, 10, "b", color);
  const who = `${data.patient.name}${data.patient.age != null ? `, ${data.patient.age} ans` : ""}`;
  pg.text(who, L + 48, y, fit(who, 10.5, "r", R - L - 200, 7), "r", INK);
  pg.right(`Le ${data.date}`, R, y, 10, "b", INK);
  y += 14;
  pg.right(`N° ${data.number ?? "APERÇU"}`, R, y, 8.5, "r", MUTED);
  pg.line(L, y + 8, R, y + 8, color, 0.8);

  y += 34;
  pg.text("R", L, y, 24, "b", color);
  pg.text("x", L + textWidth("R", 24, "b") - 4, y + 7, 15, "b", color);
  const sigTop = B - 130;
  drawItems(pg, data, L, y + 24, R - L, sigTop - 14, color);

  signatureBlock(pg, R, sigTop);
  const v = verifyLines(data);
  if (v) {
    pg.push({ t: "image", ref: "qr", x: L, y: B - 78, w: 72, h: 72, fit: "contain", align: "left" });
    pg.text("Ordonnance vérifiable", L + 80, B - 60, 8.5, "b", INK);
    const room = R - 175 - (L + 80);
    pg.text(v.url, L + 80, B - 48, fit(v.url, 7.5, "r", room, 5), "r", INK);
    pg.text(v.fingerprint, L + 80, B - 36, 7, "r", MUTED);
  } else draftWatermark(pg, L + 60, T + (B - T) * 0.7, color);
  return pg.ops;
}

export function buildSheet(data: SheetData, tpl: TemplateConfig): Op[] {
  const color = isHexColor(tpl.color) ? tpl.color : "#0f8f7e";
  if (tpl.layout === "rose") return rose(data, color);
  if (tpl.layout === "letterhead") return letterhead(data, { ...tpl, color });
  return teal(data, color);
}

/** Example content for template thumbnails. */
export function sampleSheet(doctor: SheetData["doctor"]): SheetData {
  return {
    doctor,
    patient: { name: "Patient Exemple", age: 42, country: "France" },
    date: new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Tunis" }).format(new Date()),
    number: null,
    reason: "Angine, fièvre depuis deux jours.",
    items: [
      { name: "Augmentin 1 g / 125 mg · Comprimé", dosage: "1 comprimé", frequency: "2 fois par jour", duration: "7 jours", instructions: "Au début des repas." },
      { name: "Doliprane 1 g · Comprimé", dosage: "1 comprimé", frequency: "jusqu'à 3 fois par jour", duration: "5 jours", instructions: null },
    ],
    notes: "Consulter si la fièvre persiste au-delà de 72 heures.",
    verify: null,
  };
}
