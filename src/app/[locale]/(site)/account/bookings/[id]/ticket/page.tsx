import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { Logo } from "@/components/header";
import { PrintButton } from "@/components/print-button";
import { Container } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";
import { appUrl, getSettings } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("ticket.title") };
}

export default async function TicketPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const user = await requireRole(locale, ["PATIENT"], `/${locale}/account/bookings/${id}/ticket`);
  const booking = await db.booking.findFirst({
    where: { id, patientId: user.id },
    include: { doctor: { include: { user: true } }, slot: true, accommodation: true, companions: true },
  });
  if (!booking) notFound();
  if (!booking.qrToken || !["PAID", "IN_PROGRESS", "COMPLETED"].includes(booking.status)) {
    redirect(`/${locale}/account/bookings/${booking.id}`);
  }

  const settings = await getSettings();
  // Locale-free URL: the scanning agent is redirected to their own language.
  const qr = await QRCode.toDataURL(`${appUrl()}/scan/${booking.qrToken}`, { margin: 1, width: 320, errorCorrectionLevel: "M" });

  return (
    <Container className="py-10">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton label={t("ticket.print")} />
      </div>
      <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-line bg-white print:border-0" data-testid="ticket">
        <header className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-brand to-brand-dark px-8 py-6 text-white">
          <Logo locale={locale} inverted />
          <div className="text-end">
            <p className="text-xs uppercase tracking-wider text-white/80">{t("ticket.title")}</p>
            <p className="font-mono text-xl font-bold">{booking.reference}</p>
          </div>
        </header>

        <div className="grid gap-8 p-8 sm:grid-cols-[1fr_auto]">
          <dl className="grid gap-5 text-sm sm:grid-cols-2">
            <Item label={t("ticket.patient")} value={`${user.firstName} ${user.lastName}`} />
            <Item label={t("ticket.phone")} value={user.phone ?? "—"} />
            <Item label={t("ticket.doctor")} value={`Dr ${booking.doctor.user.firstName} ${booking.doctor.user.lastName}`} />
            <Item label={t("ticket.clinic")} value={`${booking.doctor.clinicName}, ${booking.doctor.city}`} />
            <Item label={t("ticket.appointment")} value={formatDateTime(booking.slot.startsAt, locale)} />
            <Item
              label={t("ticket.stayDates")}
              value={`${booking.arrivalDate ? formatDate(booking.arrivalDate, locale) : "—"} → ${booking.departureDate ? formatDate(booking.departureDate, locale) : "—"}`}
            />
            <Item label={t("ticket.travellers")} value={String(1 + booking.companionsCount)} />
            <Item label={t("ticket.stay")} value={booking.accommodation ? `${booking.accommodation.title} — ${booking.accommodation.address}` : t("ticket.noStay")} />
          </dl>
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={t("ticket.qrAlt")} width={200} height={200} className="h-48 w-48" data-testid="ticket-qr" />
            <p className="mt-2 max-w-48 text-center text-xs text-muted">{t("ticket.qrHelp")}</p>
          </div>
        </div>

        <div className="mx-8 mb-8 rounded-2xl p-5 text-center text-lg font-bold" style={{ background: booking.withTransport ? "#ecfdf5" : "#f7f7f7" }}>
          <span className={booking.withTransport ? "text-emerald-700" : "text-ink"} data-testid="ticket-transfer">
            {booking.withTransport ? t("ticket.transferYes") : t("ticket.transferNo")}
          </span>
        </div>

        {booking.companions.length > 0 && (
          <div className="mx-8 mb-8">
            <p className="text-sm font-semibold text-ink">{t("ticket.companions")}</p>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">
              {booking.companions.map((c) => (
                <li key={c.id} className="flex justify-between px-4 py-2.5">
                  <span>
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="font-mono text-muted">{c.passportNumber}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="border-t border-line bg-surface px-8 py-5 text-xs text-muted">
          <p>{t("ticket.instructions")}</p>
          <p className="mt-2">{t("booking.support", { phone: settings.supportPhone, email: settings.supportEmail })}</p>
        </footer>
      </article>
    </Container>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 font-semibold text-ink">{value}</dd>
    </div>
  );
}
