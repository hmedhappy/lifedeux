import "server-only";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { db } from "./db";
import { appUrl } from "./settings";

export { canonicalContent, contentHash, prescriptionNumber } from "./prescription-hash";

export type PrescriptionFull = NonNullable<Awaited<ReturnType<typeof loadPrescription>>>;

export async function loadPrescription(where: { id: string } | { number: string }) {
  return db.prescription.findUnique({
    where,
    include: {
      items: { orderBy: { position: "asc" } },
      patient: { select: { firstName: true, lastName: true, country: true, birthDate: true } },
      doctor: { include: { user: { select: { firstName: true, lastName: true, phone: true } }, specialty_: true } },
    },
  });
}

export function verifyUrl(number: string): string {
  return `${appUrl()}/verify/${number}`;
}

const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** The standard PDF fonts only cover Latin-1; other characters are replaced. */
function safe(text: string): string {
  return [...text.normalize("NFC")]
    .map((c) => {
      const code = c.codePointAt(0)!;
      if (c === "\n" || c === "\t") return " ";
      return (code >= 32 && code < 127) || (code >= 160 && code < 256) || WIN_ANSI_EXTRA.has(c) ? c : "?";
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of safe(text).split(/\s{2,}|\r/)) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

async function imageBytes(id: string | null) {
  if (!id) return null;
  const img = await db.image.findUnique({ where: { id } });
  return img ? { bytes: img.data, mime: img.mime } : null;
}

const BRAND = rgb(0.89, 0.11, 0.37);
const INK = rgb(0.13, 0.13, 0.13);
const MUTED = rgb(0.42, 0.42, 0.42);

/** Renders the prescription. Drafts get a "preview" watermark and no QR code. */
export async function renderPrescriptionPdf(p: PrescriptionFull): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Ordonnance ${p.number ?? "(aperçu)"}`);
  pdf.setAuthor(`Dr ${p.doctor.user.firstName} ${p.doctor.user.lastName}`);
  pdf.setProducer("LifeDeux");
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const { width, height } = page.getSize();
  const M = 48;
  const text = (pg: PDFPage, s: string, x: number, y: number, size = 10, font = regular, color = INK) =>
    pg.drawText(safe(s), { x, y, size, font, color });

  // Header band
  page.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: BRAND });
  text(page, "LifeDeux", M, height - 48, 22, bold, rgb(1, 1, 1));
  text(page, "Téléconsultation", M, height - 66, 10, regular, rgb(1, 1, 1));
  const title = "ORDONNANCE MÉDICALE";
  text(page, title, width - M - bold.widthOfTextAtSize(title, 16), height - 50, 16, bold, rgb(1, 1, 1));
  const sub = "Medical prescription";
  text(page, sub, width - M - regular.widthOfTextAtSize(sub, 10), height - 66, 10, regular, rgb(1, 1, 1));

  // Doctor and prescription identity
  let y = height - 130;
  const d = p.doctor;
  text(page, `Dr ${d.user.firstName} ${d.user.lastName}`, M, y, 14, bold);
  y -= 16;
  text(page, d.specialty_ ? `${d.specialty_.nameFr} — ${d.specialty}` : d.specialty, M, y, 10, regular, MUTED);
  y -= 14;
  if (d.licenseNumber) {
    text(page, `N° d'inscription à l'Ordre : ${d.licenseNumber}`, M, y, 10, regular, MUTED);
    y -= 14;
  }
  text(page, `${d.clinicName} — ${d.clinicAddress}, ${d.city}`, M, y, 10, regular, MUTED);
  if (d.user.phone) {
    y -= 14;
    text(page, `Tél. ${d.user.phone}`, M, y, 10, regular, MUTED);
  }
  const issued = p.issuedAt ?? new Date();
  const dateStr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Tunis" }).format(issued);
  const right = (s: string, yy: number, size = 10, font = regular) => text(page, s, width - M - font.widthOfTextAtSize(safe(s), size), yy, size, font);
  right(`Le ${dateStr}`, height - 130, 10, bold);
  right(`N° ${p.number ?? "APERÇU"}`, height - 146);

  // Patient
  y -= 30;
  page.drawLine({ start: { x: M, y: y + 12 }, end: { x: width - M, y: y + 12 }, thickness: 0.7, color: rgb(0.87, 0.87, 0.87) });
  text(page, "Patient :", M, y - 4, 11, bold);
  text(page, `${p.patient.firstName} ${p.patient.lastName}${p.patient.country ? ` (${p.patient.country})` : ""}`, M + 58, y - 4, 11);
  y -= 34;

  // Items
  p.items.forEach((item, index) => {
    if (y < 230) return;
    text(page, `${index + 1}.`, M, y, 12, bold, BRAND);
    const lines = wrap(item.name, bold, 12, width - 2 * M - 20);
    lines.forEach((l, i) => text(page, l, M + 20, y - i * 15, 12, bold));
    y -= lines.length * 15;
    for (const l of wrap(`${item.dosage} — ${item.frequency} — pendant ${item.duration}`, regular, 10.5, width - 2 * M - 20)) {
      text(page, l, M + 20, y, 10.5);
      y -= 14;
    }
    if (item.instructions) {
      for (const l of wrap(item.instructions, italic, 10, width - 2 * M - 20)) {
        text(page, l, M + 20, y, 10, italic, MUTED);
        y -= 13;
      }
    }
    y -= 10;
  });
  if (p.notes) {
    y -= 4;
    text(page, "Remarques :", M, y, 10.5, bold);
    y -= 14;
    for (const l of wrap(p.notes, regular, 10, width - 2 * M)) {
      if (y < 200) break;
      text(page, l, M, y, 10);
      y -= 13;
    }
  }

  // Stamp and signature
  const boxY = 70;
  const stamp = await imageBytes(d.stampImageId);
  const signature = await imageBytes(d.signatureImageId);
  const embed = async (img: { bytes: Uint8Array; mime: string } | null) =>
    img ? (img.mime === "image/png" ? pdf.embedPng(img.bytes) : img.mime === "image/jpeg" ? pdf.embedJpg(img.bytes) : null) : null;
  const [stampImg, signatureImg] = await Promise.all([embed(stamp), embed(signature)]);
  const signLabel = "Cachet et signature du médecin";
  text(page, signLabel, width - M - regular.widthOfTextAtSize(signLabel, 9), boxY + 118, 9, regular, MUTED);
  // The signature overlaps the stamp, as on a paper prescription.
  if (stampImg) {
    const s = stampImg.scaleToFit(105, 105);
    page.drawImage(stampImg, { x: width - M - 165, y: boxY, width: s.width, height: s.height });
  }
  if (signatureImg) {
    const s = signatureImg.scaleToFit(100, 55);
    page.drawImage(signatureImg, { x: width - M - s.width, y: boxY + 8, width: s.width, height: s.height });
  }

  // Verification block
  if (p.status === "ISSUED" && p.number && p.contentHash) {
    const qr = await QRCode.toBuffer(verifyUrl(p.number), { margin: 1, width: 240, errorCorrectionLevel: "M" });
    const qrImg = await pdf.embedPng(qr);
    page.drawImage(qrImg, { x: M, y: boxY, width: 96, height: 96 });
    text(page, "Ordonnance vérifiable", M + 106, boxY + 80, 10, bold);
    text(page, "Scannez le QR code ou ouvrez :", M + 106, boxY + 64, 8.5, regular, MUTED);
    const url = verifyUrl(p.number);
    // Long hosts get a smaller font so the link never runs into the stamp.
    const room = width - M - 175 - (M + 106);
    const size = Math.max(5.5, Math.min(8, (8 * room) / regular.widthOfTextAtSize(url, 8)));
    text(page, url, M + 106, boxY + 52, size, regular, INK);
    text(page, `Empreinte : ${p.contentHash.slice(0, 16).toUpperCase()}`, M + 106, boxY + 20, 8.5, regular, MUTED);
  } else {
    page.drawText("APERÇU — NON VALABLE", {
      x: 120,
      y: 300,
      size: 44,
      font: bold,
      color: rgb(0.89, 0.11, 0.37),
      opacity: 0.18,
      rotate: degrees(35),
    });
  }

  page.drawLine({ start: { x: M, y: 50 }, end: { x: width - M, y: 50 }, thickness: 0.5, color: rgb(0.87, 0.87, 0.87) });
  text(page, "Document émis via LifeDeux à la suite d'une téléconsultation. Valable après vérification.", M, 36, 8, regular, MUTED);
  return pdf.save();
}
