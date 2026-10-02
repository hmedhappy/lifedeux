import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { appUrl } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEAL = rgb(15 / 255, 118 / 255, 110 / 255);
const INK = rgb(0.09, 0.13, 0.12);
const MUTED = rgb(0.36, 0.42, 0.41);

/** Standard PDF fonts only cover Latin-1: anything else is replaced. */
const latin1 = (s: string) => s.normalize("NFC").replace(/[^\u0000-ÿ€’–—…]/g, "?").replace(/[’]/g, "'").replace(/[–—]/g, "-").replace("…", "...");

/**
 * The stay pass as a PDF the patient keeps on their phone, readable without network.
 * Texts are in the patient's language when it uses Latin letters, French otherwise.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const b = user
    ? await db.booking.findFirst({
        where: { id, patientId: user.id, status: { in: ["PAID", "IN_PROGRESS", "COMPLETED"] }, qrToken: { not: null } },
        include: { operation: true, slot: true, accommodation: true, doctor: { include: { user: true } } },
      })
    : null;
  if (!user || !b?.qrToken) return new Response("Not found", { status: 404 });

  const locale = toLocale(user.locale) === "ar" ? "fr" : toLocale(user.locale);
  const t = getT(locale);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 640]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const text = (s: string, x: number, y: number, size = 11, f = font, color = INK) => page.drawText(latin1(s), { x, y, size, font: f, color });

  page.drawRectangle({ x: 0, y: 560, width: 420, height: 80, color: TEAL });
  text("LifeDeux", 28, 606, 20, bold, rgb(1, 1, 1));
  text(t("ticket.title"), 28, 584, 11, font, rgb(1, 1, 1));
  text(b.reference, 300, 606, 13, bold, rgb(1, 1, 1));

  const qr = await QRCode.toBuffer(`${appUrl()}/scan/${b.qrToken}`, { margin: 1, width: 360, errorCorrectionLevel: "M" });
  const png = await pdf.embedPng(qr);
  page.drawImage(png, { x: 110, y: 330, width: 200, height: 200 });

  let y = 300;
  const row = (label: string, value: string) => {
    text(label, 28, y, 9, font, MUTED);
    text(value, 28, y - 14, 12, bold);
    y -= 38;
  };
  row(t("ticket.patient"), `${user.firstName} ${user.lastName}`);
  row(t("ticket.appointment"), `${localized(b.operation, "name", locale)} - ${formatDateTime(b.slot.startsAt, locale)}`);
  row(t("ticket.clinic"), `${b.doctor.clinicName} - Dr ${b.doctor.user.lastName}`);
  if (b.arrivalDate && b.departureDate) row(t("ticket.stayDates"), `${formatDate(b.arrivalDate, locale)} -> ${formatDate(b.departureDate, locale)}`);
  row(t("ticket.stay"), b.accommodation ? `${b.accommodation.title}, ${b.accommodation.city}` : "-");
  row(t("booking.transfer"), b.withTransport ? t("ticket.transferYes") : t("ticket.transferNo"));
  text(t("ticket.pdfFooter"), 28, 24, 8, font, MUTED);

  const bytes = await pdf.save();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="lifedeux-${b.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
