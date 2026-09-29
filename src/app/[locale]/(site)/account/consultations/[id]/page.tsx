import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Video } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Chat } from "@/components/chat";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/forms";
import { SpecialtyIcon } from "@/components/specialty-icon";
import { StatusBadge } from "@/components/status";
import { Avatar, Container, LinkButton, Notice } from "@/components/ui";
import { cancelConsultationAction, startConsultationPaymentAction } from "@/actions/consultation";
import { requireRole } from "@/lib/auth";
import { expireOverdueBookings } from "@/lib/bookings";
import { CHAT_OPENS_MINUTES_BEFORE } from "@/lib/consultation-rules";
import { getConsultationForUser, loadMessages } from "@/lib/consultations";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { availableProviders } from "@/lib/payments";
import { getSettings } from "@/lib/settings";

export default async function PatientConsultationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ payment?: string; requested?: string }>;
}) {
  const { locale: raw, id } = await params;
  const { payment, requested } = await searchParams;
  const locale = toLocale(raw);
  const t = getT(locale);
  const user = await requireRole(locale, ["PATIENT"], `/${locale}/account/consultations/${id}`);
  await expireOverdueBookings();

  const found = await getConsultationForUser(id, user);
  if (!found || found.as !== "patient") notFound();
  const { consultation: c, chat } = found;
  const doctorName = `Dr ${c.doctor.user.firstName} ${c.doctor.user.lastName}`;
  const specialty = c.doctor.specialty_ ? localized(c.doctor.specialty_, "name", locale) : c.doctor.specialty;
  const money = (v: number) => formatMoney(v, c.currency, locale);
  const settings = await getSettings();
  const providers = availableProviders();
  const showChat = chat === "open" || chat === "closed" || chat === "waiting";
  const messages = showChat ? await loadMessages(c.id, user.id) : [];

  return (
    <Container className="py-10">
      <Link href={`/${locale}/account`} className="text-sm font-medium text-ink underline">
        ← {t("account.title")}
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("consult.title")}</h1>
        <StatusBadge status={c.status} t={t} />
      </div>
      <p className="mt-1 text-muted">
        {t("booking.reference")} <span className="font-mono font-semibold text-ink">{c.reference}</span>
      </p>

      <div className="mt-8 space-y-6">
        {requested && c.status === "REQUESTED" && <Notice tone="success">{t("consult.requestSent")}</Notice>}
        {payment === "success" && c.status === "CONFIRMED" && (
          <>
            <Notice tone="info">{t("booking.paymentProcessing")}</Notice>
            <AutoRefresh />
          </>
        )}
        {payment === "cancelled" && c.status === "CONFIRMED" && <Notice tone="warning">{t("booking.paymentCancelled")}</Notice>}
      </div>

      {showChat ? (
        <div className="mt-8 space-y-4">
          {chat === "waiting" && (
            <Notice tone="info">
              {t("consult.waitingText", { date: formatDateTime(c.slot.startsAt, locale), minutes: CHAT_OPENS_MINUTES_BEFORE })}
            </Notice>
          )}
          {chat === "waiting" && <AutoRefresh every={30000} times={120} />}
          {chat === "closed" && <Notice tone="info">{t("consult.closedText")}</Notice>}
          <Chat
            consultationId={c.id}
            peerName={doctorName}
            peerSubtitle={specialty}
            initialMessages={messages}
            initialState={chat}
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-6">
            {c.status === "REQUESTED" && (
              <Block title={t("consult.requestedTitle")} text={t("consult.requestedText", { doctor: doctorName })} />
            )}
            {c.status === "REFUSED" && (
              <Block
                title={t("booking.refusedTitle")}
                text={t("booking.refusedText", { reason: c.refusalReason ?? "—" })}
                action={<LinkButton href={`/${locale}/doctors`}>{t("account.findDoctor")}</LinkButton>}
              />
            )}
            {c.status === "EXPIRED" && (
              <Block
                title={t("booking.expiredTitle")}
                text={t("consult.expiredText")}
                action={<LinkButton href={`/${locale}/doctors/${c.doctorId}?service=consultation`}>{t("booking.rebook")}</LinkButton>}
              />
            )}
            {c.status === "CANCELLED" && <Block title={t("booking.cancelledTitle")} text={t("consult.cancelledText")} />}

            {c.status === "CONFIRMED" && (
              <section className="space-y-6" id="payment">
                <Block title={t("consult.confirmedTitle")} text={t("consult.confirmedText", { doctor: doctorName })} />
                {c.paymentDeadline && (
                  <Notice tone="warning">{t("booking.deadline", { date: formatDateTime(c.paymentDeadline, locale) })}</Notice>
                )}
                {providers.length === 0 ? (
                  <Notice tone="error">{t("errors.providerUnavailable")}</Notice>
                ) : (
                  <ActionForm action={startConsultationPaymentAction.bind(null, locale, c.id)} className="space-y-4">
                    <fieldset className="space-y-3">
                      <legend className="mb-3 text-sm font-medium text-ink">{t("pay.method")}</legend>
                      {providers.map((p, i) => (
                        <label key={p.id} className="flex cursor-pointer items-start gap-4 rounded-2xl border-2 border-line p-5 has-[:checked]:border-ink">
                          <input type="radio" name="provider" value={p.id} defaultChecked={i === 0} className="mt-1 h-4 w-4 accent-brand" />
                          <span>
                            <span className="block font-semibold text-ink">{t(`pay.providers.${p.id}.title`)}</span>
                            <span className="block text-sm text-muted">{t(`pay.providers.${p.id}.text`)}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <SubmitButton size="lg" className="w-full">
                      {t("pay.button", { amount: money(c.price) })}
                    </SubmitButton>
                    <p className="text-center text-xs text-muted">{t("pay.secure")}</p>
                  </ActionForm>
                )}
              </section>
            )}

            {(c.status === "REQUESTED" || c.status === "CONFIRMED") && (
              <form action={cancelConsultationAction.bind(null, locale, c.id)} className="border-t border-line pt-6">
                <ConfirmSubmit message={t("consult.cancelConfirm")}>{t("consult.cancel")}</ConfirmSubmit>
              </form>
            )}
          </div>

          <aside>
            <div className="sticky top-28 space-y-5 rounded-2xl border border-line p-6 shadow-float">
              <div className="flex items-center gap-4">
                <Avatar name={`${c.doctor.user.firstName} ${c.doctor.user.lastName}`} src={c.doctor.photoUrl} size={52} />
                <div>
                  <p className="font-semibold text-ink">{doctorName}</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted">
                    <SpecialtyIcon name={c.doctor.specialty_?.icon ?? "Stethoscope"} className="h-4 w-4" aria-hidden />
                    {specialty}
                  </p>
                </div>
              </div>
              <dl className="space-y-3 border-t border-line pt-5 text-sm">
                <Row label={t("consult.when")} value={formatDateTime(c.slot.startsAt, locale)} />
                <Row label={t("consult.duration")} value={t("consult.minutes", { n: c.durationMinutes })} />
                <Row label={t("consult.mode")} value={t("consult.modeChat")} />
              </dl>
              {c.reason && (
                <p className="rounded-xl bg-surface p-4 text-sm text-ink">
                  <span className="block text-xs font-semibold text-muted">{t("consult.reason")}</span>
                  {c.reason}
                </p>
              )}
              <div className="flex justify-between gap-4 border-t border-line pt-4 text-base font-semibold text-ink">
                <span>{t("price.total")}</span>
                <span data-testid="consult-total">{money(c.price)}</span>
              </div>
              <ul className="space-y-2 text-xs text-muted">
                <li className="flex gap-2">
                  <Video className="h-4 w-4 shrink-0" aria-hidden />
                  {t("consult.howChat")}
                </li>
                <li className="flex gap-2">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden />
                  {t("consult.howOpens", { minutes: CHAT_OPENS_MINUTES_BEFORE })}
                </li>
              </ul>
              <p className="text-xs text-muted">{t("booking.support", { phone: settings.supportPhone, email: settings.supportEmail })}</p>
            </div>
          </aside>
        </div>
      )}
    </Container>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-medium text-ink">{value}</dd>
    </div>
  );
}

function Block({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line p-6">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-muted">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
