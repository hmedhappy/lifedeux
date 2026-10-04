import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { SubmitButton } from "@/components/forms";
import { Avatar, Container, Notice } from "@/components/ui";
import { confirmBookingAction } from "@/actions/qr";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("qrBook.confirmTitle"), robots: { index: false } };
}

/** Opened from the email: one tap confirms the booking made from the practice QR code. */
export default async function ConfirmBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale: raw, token } = await params;
  const { error } = await searchParams;
  const locale = toLocale(raw);
  const t = getT(locale);
  const c = await db.consultation.findUnique({
    where: { emailConfirmToken: token },
    include: { slot: true, doctor: { include: { user: true } } },
  });
  const pending = c && c.status === "UNVERIFIED" && c.emailConfirmExpiresAt && c.emailConfirmExpiresAt > new Date();
  const done = c && ["REQUESTED", "CONFIRMED"].includes(c.status);

  return (
    <Container className="flex justify-center py-8 sm:py-16">
      <div className="w-full max-w-md animate-fade-in rounded-3xl border border-line bg-white p-6 text-center shadow-card sm:p-8" data-testid="confirm-booking">
        {c && (
          <>
            <div className="flex justify-center">
              <Avatar name={`${c.doctor.user.firstName} ${c.doctor.user.lastName}`} src={c.doctor.photoUrl} size={72} />
            </div>
            <h1 className="mt-4 text-xl font-bold text-ink">
              Dr {c.doctor.user.firstName} {c.doctor.user.lastName}
            </h1>
            <p className="mt-3 flex items-center justify-center gap-2 font-semibold text-ink first-letter:uppercase">
              <CalendarDays className="h-5 w-5 text-brand" aria-hidden />
              {formatDateTime(c.slot.startsAt, locale)}
            </p>
            {c.doctor.clinicAddress && (
              <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted">
                <MapPin className="h-4 w-4" aria-hidden />
                {[c.doctor.clinicAddress, c.doctor.city].filter(Boolean).join(", ")}
              </p>
            )}
          </>
        )}
        <div className="mt-6">
          {pending && !error ? (
            <form action={confirmBookingAction.bind(null, locale, token)}>
              <SubmitButton size="lg" className="w-full" testId="confirm-booking-button">
                {t("qrBook.confirmButton")}
              </SubmitButton>
            </form>
          ) : done ? (
            <Link href={`/${locale}/account/consultations/${c.id}`} className="font-semibold text-brand underline">
              {t("qrBook.alreadyConfirmed")}
            </Link>
          ) : (
            <div className="space-y-4">
              <Notice tone="error">{t("qrBook.linkExpired")}</Notice>
              {c && (
                <Link href={`/${locale}/doctors/${c.doctorId}?service=cabinet`} className="font-semibold text-brand underline">
                  {t("qrBook.bookAgain")}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
