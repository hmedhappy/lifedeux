import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { doctorActs, monthRange } from "@/lib/earnings";
import { formatDate, formatMoney } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const latin1 = (s: string) => s.normalize("NFC").replace(/[’]/g, "'").replace(/[–—]/g, "-").replace(/[^\u0000-ÿ€]/g, "?");

/** Monthly statement of a doctor (acts, fees, payouts) as a PDF, for the admin. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const doctorId = url.searchParams.get("doctorId") ?? "";
  const month = url.searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Bad month", { status: 400 });
  const doctor = await db.doctor.findUnique({ where: { id: doctorId }, include: { user: true } });
  if (!doctor) return new Response("Not found", { status: 404 });

  const locale = "fr" as const;
  const t = getT(locale);
  const settings = await getSettings();
  const money = (v: number) => latin1(formatMoney(v, settings.currency, locale));
  const { from, to } = monthRange(month);
  const [acts, payouts] = await Promise.all([
    doctorActs(doctor.id, from, to, locale, t("consult.short")),
    db.doctorPayout.findMany({ where: { doctorId, paidAt: { gte: from, lt: to } }, orderBy: { paidAt: "asc" } }),
  ]);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 790;
  const line = (s: string, x: number, size = 10, f = font, color = rgb(0.09, 0.13, 0.12)) => page.drawText(latin1(s), { x, y, size, font: f, color });
  const newline = (h = 16) => {
    y -= h;
    if (y < 60) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
  };

  line("LifeDeux", 48, 18, bold, rgb(15 / 255, 118 / 255, 110 / 255));
  newline(26);
  line(`${t("statement.title")} - ${month}`, 48, 13, bold);
  newline(18);
  line(`Dr ${doctor.user.firstName} ${doctor.user.lastName}${doctor.licenseNumber ? ` - ${doctor.licenseNumber}` : ""}`, 48, 11);
  newline(30);

  line(t("statement.acts"), 48, 11, bold);
  newline(18);
  for (const a of acts) {
    line(formatDate(a.at, locale), 48);
    line(`${a.label} - ${a.who}`, 140);
    line(money(a.fee), 480);
    newline();
  }
  if (acts.length === 0) {
    line("-", 48);
    newline();
  }
  const earned = acts.reduce((s, a) => s + a.fee, 0);
  newline(6);
  line(t("statement.totalActs"), 48, 10, bold);
  line(money(earned), 480, 10, bold);
  newline(30);

  line(t("statement.payouts"), 48, 11, bold);
  newline(18);
  for (const p of payouts) {
    line(formatDate(p.paidAt, locale), 48);
    line(`${t(`payoutMethod.${p.method}`)}${p.note ? ` - ${p.note}` : ""}`, 140);
    line(money(p.amount), 480);
    newline();
  }
  const paid = payouts.reduce((s, p) => s + p.amount, 0);
  newline(6);
  line(t("statement.totalPaid"), 48, 10, bold);
  line(money(paid), 480, 10, bold);

  const bytes = await pdf.save();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="releve-${month}-${doctor.user.lastName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
