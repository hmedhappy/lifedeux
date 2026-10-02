import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Check, Clock, CreditCard, FileText, Lock, MessageCircle, RotateCcw, ShieldCheck, Star } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Chat } from "@/components/chat";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/forms";
import { RescheduleSheet } from "@/components/reschedule-sheet";
import { ReviewForm } from "@/components/review-form";
import { SpecialtyIcon } from "@/components/specialty-icon";
import { StatusBadge } from "@/components/status";
import { Avatar, Badge, Container, Disclosure, LinkButton, Notice } from "@/components/ui";
import {
  cancelConsultationAction,
  requestRescheduleAction,
  startConsultationPaymentAction,
  submitReviewAction,
  withdrawRescheduleAction,
} from "@/actions/consultation";
import type { ActionState } from "@/lib/action-state";
import { requireRole } from "@/lib/auth";
import { expireOverdueBookings } from "@/lib/bookings";
import { CHAT_OPENS_MINUTES_BEFORE, CONSULT_MIN_LEAD_HOURS, canChangeFreely } from "@/lib/consultation-rules";
import { getConsultationForUser, loadMessages } from "@/lib/consultations";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getT, localized, toLocale, type TFunction } from "@/lib/i18n";
import { providersFor, type PaymentProvider } from "@/lib/payments";
import { getSettings } from "@/lib/settings";
import { toSlotOptions } from "@/lib/slot-options";

const STEPS = ["requested", "accepted", "paid", "consultation", "prescription"] as const;
const CANCEL_OUTCOMES = ["cancelled", "refunded", "refundPending", "tooLate", "invalid"];

/** Free consultation slots of the same doctor that the patient may move to. */
function moveCandidates(doctorId: string) {
  return db.slot.findMany({
    where: { doctorId, kind: "CONSULTATION", status: "FREE", startsAt: { gt: new Date(Date.now() + CONSULT_MIN_LEAD_HOURS * 3_600_000) } },
    orderBy: { startsAt: "asc" },
    take: 120,
  });
}

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export default async function PatientConsultationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ payment?: string; requested?: string; cancel?: string }>;
}) {
  const { locale: raw, id } = await params;
  const { payment, requested, cancel } = await searchParams;
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
  const freeChange = canChangeFreely(c.slot.startsAt);

  const [settings, hold, prescriptions, review, moveSlot] = await Promise.all([
    getSettings(),
    db.payment.findFirst({ where: { consultationId: c.id, status: "AUTHORIZED" } }),
    db.prescription.findMany({
      where: { consultationId: c.id, status: { in: ["ISSUED", "REVOKED"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, status: true },
    }),
    db.review.findUnique({ where: { consultationId: c.id } }),
    c.rescheduleSlotId ? db.slot.findUnique({ where: { id: c.rescheduleSlotId } }) : null,
  ]);
  const canMove = (c.status === "CONFIRMED" || c.status === "PAID") && freeChange && !c.rescheduleSlotId;
  const moveOptions = canMove ? toSlotOptions(await moveCandidates(c.doctorId), locale) : [];

  // Before the chat opens, the timeline (with its options) says what comes next.
  const showChat = chat === "open" || chat === "closed";
  const messages = showChat ? await loadMessages(c.id, user.id) : [];
  const ended = ["REFUSED", "EXPIRED", "CANCELLED"].includes(c.status);
  const done: Record<(typeof STEPS)[number], boolean> = {
    requested: true,
    accepted: ["CONFIRMED", "PAID", "COMPLETED", "NO_SHOW"].includes(c.status),
    paid: ["PAID", "COMPLETED", "NO_SHOW"].includes(c.status),
    consultation: c.status === "COMPLETED",
    prescription: prescriptions.some((p) => p.status === "ISSUED"),
  };
  const current = STEPS.find((s) => !done[s]);
  const payAction = startConsultationPaymentAction.bind(null, locale, c.id);

  const options = (c.status === "REQUESTED" || c.status === "CONFIRMED" || c.status === "PAID") && (
    <Disclosure summary={t("consult.moreOptions")}>
      <div className="space-y-4" data-testid="consult-options">
        {moveSlot ? (
          <div className="rounded-2xl bg-surface p-4 text-sm" data-testid="reschedule-pending">
            <p className="text-ink">{t("consult.reschedulePending", { date: formatDateTime(moveSlot.startsAt, locale) })}</p>
            <form action={withdrawRescheduleAction.bind(null, locale, c.id)} className="mt-3">
              <SubmitButton variant="ghost" size="sm">
                {t("consult.rescheduleWithdraw")}
              </SubmitButton>
            </form>
          </div>
        ) : (
          canMove && <RescheduleSheet slots={moveOptions} action={requestRescheduleAction.bind(null, locale, c.id)} />
        )}
        {c.status !== "PAID" || freeChange ? (
          <form action={cancelConsultationAction.bind(null, locale, c.id)}>
            <ConfirmSubmit message={t(c.status === "PAID" ? "consult.cancelPaidConfirm" : "consult.cancelConfirm")} variant="danger" testId="consult-cancel">
              {t("consult.cancel")}
            </ConfirmSubmit>
          </form>
        ) : (
          <p className="flex gap-2 text-sm text-muted">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {t("consult.cancelLocked")}
          </p>
        )}
        <p className="text-xs text-muted">{t("consult.cancelPolicy")}</p>
      </div>
    </Disclosure>
  );

  return (
    <Container className="py-6 sm:py-10">
      {/* The chat header already names the doctor and has its own back arrow. */}
      {!showChat && (
        <>
          <Link href={`/${locale}/account`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            {t("account.title")}
          </Link>

          <header className="mt-2 flex flex-wrap items-center gap-4">
            <Avatar name={`${c.doctor.user.firstName} ${c.doctor.user.lastName}`} src={c.doctor.photoUrl} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{doctorName}</h1>
                <StatusBadge status={c.status} t={t} />
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <SpecialtyIcon name={c.doctor.specialty_?.icon ?? "Stethoscope"} className="h-4 w-4" aria-hidden />
                  {specialty}
                </span>
                <span className="font-medium text-ink">{formatDateTime(c.slot.startsAt, locale)}</span>
                <span className="font-mono text-xs">{c.reference}</span>
              </p>
            </div>
          </header>
        </>
      )}

      <div className={clsx("space-y-3 empty:hidden", showChat ? "mb-4" : "mt-6")}>
        {requested && c.status === "REQUESTED" && <Notice tone="success">{t("consult.requestSent")}</Notice>}
        {payment === "success" && (c.status === "CONFIRMED" || (c.status === "REQUESTED" && !hold)) && (
          <>
            <Notice tone="info">{t("booking.paymentProcessing")}</Notice>
            <AutoRefresh />
          </>
        )}
        {payment === "cancelled" && (c.status === "CONFIRMED" || c.status === "REQUESTED") && (
          <Notice tone="warning">{t("booking.paymentCancelled")}</Notice>
        )}
        {cancel && CANCEL_OUTCOMES.includes(cancel) && (
          <Notice tone={cancel === "cancelled" || cancel === "refunded" ? "success" : "warning"}>{t(`consult.cancelOutcome.${cancel}`)}</Notice>
        )}
      </div>

      {showChat ? (
        <div className="space-y-4">
          {c.status === "NO_SHOW" && <Notice tone="warning">{t("consult.noShowText")}</Notice>}
          <Chat
            consultationId={c.id}
            peerName={doctorName}
            peerSubtitle={specialty}
            peerPhoto={c.doctor.photoUrl}
            initialMessages={messages}
            initialState={chat}
            orientation={{
              clinic: `${c.doctor.clinicName}, ${c.doctor.clinicAddress}`,
              surgeryHref: `/${locale}/doctors/${c.doctorId}?service=operation`,
            }}
            backHref={`/${locale}/account`}
            fullscreenMobile={chat === "open"}
          />
          {chat === "closed" && (
            <AfterCare
              t={t}
              locale={locale}
              doctorId={c.doctorId}
              prescriptions={prescriptions}
              review={review}
              canReview={c.status === "COMPLETED"}
              reviewAction={submitReviewAction.bind(null, locale, c.id)}
            />
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-6">
            {ended ? (
              <Block
                title={t(c.status === "REFUSED" ? "booking.refusedTitle" : c.status === "EXPIRED" ? "booking.expiredTitle" : "booking.cancelledTitle")}
                text={
                  c.status === "REFUSED"
                    ? t("booking.refusedText", { reason: c.refusalReason ?? "—" })
                    : t(c.status === "EXPIRED" ? "consult.expiredText" : "consult.cancelledText")
                }
                action={
                  <LinkButton href={c.status === "REFUSED" ? `/${locale}/doctors` : `/${locale}/doctors/${c.doctorId}?service=consultation`}>
                    {c.status === "REFUSED" ? t("account.findDoctor") : t("booking.rebook")}
                  </LinkButton>
                }
              />
            ) : (
              <ol className="rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6" data-testid="consult-timeline">
                {STEPS.map((step, i) => {
                  const isDone = done[step];
                  const isCurrent = step === current;
                  return (
                    <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < STEPS.length - 1 && (
                        <span className={clsx("absolute start-[15px] top-8 h-[calc(100%-2rem)] w-0.5", isDone ? "bg-brand" : "bg-line")} aria-hidden />
                      )}
                      <span
                        className={clsx(
                          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                          isDone ? "border-brand bg-brand text-white" : isCurrent ? "border-brand bg-white text-brand" : "border-line bg-white text-muted",
                        )}
                      >
                        {isDone ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className={clsx("font-semibold", isDone || isCurrent ? "text-ink" : "text-muted")}>{t(`consult.steps.${step}`)}</p>
                        {isCurrent && step === "consultation" && <AutoRefresh every={30000} times={120} />}
                        {isCurrent && (
                          <div className="mt-3 animate-fade-in" data-testid="consult-next">
                            <StepAction
                              step={step}
                              t={t}
                              status={c.status}
                              doctorName={doctorName}
                              held={!!hold}
                              deadline={c.paymentDeadline ? formatDateTime(c.paymentDeadline, locale) : null}
                              price={money(c.price)}
                              providers={providersFor(user.country, { hold: c.status === "REQUESTED" })}
                              payAction={payAction}
                              date={formatDateTime(c.slot.startsAt, locale)}
                            />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {options}
          </div>

          <aside>
            <div className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-card lg:sticky lg:top-24">
              <dl className="space-y-3 text-sm">
                <Row label={t("consult.when")} value={formatDateTime(c.slot.startsAt, locale)} />
                <Row label={t("consult.duration")} value={t("consult.minutes", { n: c.durationMinutes })} />
                <Row label={t("consult.mode")} value={t("consult.modeChat")} />
              </dl>
              {c.reason && (
                <p className="rounded-2xl bg-surface p-4 text-sm text-ink">
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
                  <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
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

/** The one thing to do at the current step of the timeline. */
function StepAction({
  step,
  t,
  status,
  doctorName,
  held,
  deadline,
  price,
  providers,
  payAction,
  date,
}: {
  step: (typeof STEPS)[number];
  t: TFunction;
  status: string;
  doctorName: string;
  held: boolean;
  deadline: string | null;
  price: string;
  providers: PaymentProvider[];
  payAction: FormAction;
  date: string;
}) {
  if (step === "accepted") {
    if (held) {
      return (
        <p className="flex gap-2 rounded-2xl bg-brand-soft p-4 text-sm text-brand-dark" data-testid="hold-done">
          <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />
          {t("consult.holdDone", { doctor: doctorName, amount: price })}
        </p>
      );
    }
    // No provider can hold a card (Konnect only): the patient pays once accepted.
    if (providers.length === 0) return <p className="text-sm text-muted">{t("consult.requestedText", { doctor: doctorName })}</p>;
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">{t("consult.holdText", { doctor: doctorName })}</p>
        <PayForm t={t} providers={providers} action={payAction} label={t("consult.holdButton", { amount: price })} testId="hold-submit" />
      </div>
    );
  }
  if (step === "paid" && status === "CONFIRMED") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">{t("consult.confirmedText", { doctor: doctorName })}</p>
        {deadline && <Notice tone="warning">{t("booking.deadline", { date: deadline })}</Notice>}
        {providers.length ? (
          <PayForm t={t} providers={providers} action={payAction} label={t("pay.button", { amount: price })} testId="pay-submit" />
        ) : (
          <Notice tone="error">{t("errors.providerUnavailable")}</Notice>
        )}
      </div>
    );
  }
  if (step === "consultation") {
    return <p className="text-sm text-muted">{t("consult.waitingText", { date, minutes: CHAT_OPENS_MINUTES_BEFORE })}</p>;
  }
  return null;
}

function PayForm({
  t,
  providers,
  action,
  label,
  testId,
}: {
  t: TFunction;
  providers: PaymentProvider[];
  action: FormAction;
  label: string;
  testId: string;
}) {
  return (
    <ActionForm action={action} className="space-y-3">
      {providers.length > 1 ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-ink">{t("pay.method")}</legend>
          {providers.map((p, i) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-line p-4 transition has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40"
            >
              <input type="radio" name="provider" value={p.id} defaultChecked={i === 0} className="mt-1 h-4 w-4 accent-brand" />
              <span>
                <span className="block font-semibold text-ink">{t(`pay.providers.${p.id}.title`)}</span>
                <span className="block text-sm text-muted">{t(`pay.providers.${p.id}.text`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <input type="hidden" name="provider" value={providers[0].id} />
      )}
      <SubmitButton size="lg" className="w-full" testId={testId}>
        <CreditCard className="h-4 w-4" aria-hidden />
        {label}
      </SubmitButton>
      <p className="text-center text-xs text-muted">{t("pay.secure")}</p>
    </ActionForm>
  );
}

/** After the consultation: prescriptions, a review, and booking again. */
function AfterCare({
  t,
  locale,
  doctorId,
  prescriptions,
  review,
  canReview,
  reviewAction,
}: {
  t: TFunction;
  locale: string;
  doctorId: string;
  prescriptions: { id: string; number: string | null; status: string }[];
  review: { rating: number; text: string | null } | null;
  canReview: boolean;
  reviewAction: FormAction;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {prescriptions.length > 0 && (
        <section className="rounded-3xl border border-line bg-white p-5 shadow-card md:col-span-2">
          <h2 className="mb-3 font-semibold text-ink">{t("documents.prescriptions")}</h2>
          <ul className="space-y-2">
            {prescriptions.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm text-ink">
                  <FileText className="h-4 w-4 text-brand" aria-hidden />
                  <span className="font-mono">{p.number}</span>
                  {p.status === "REVOKED" && <Badge tone="red">{t("documents.revoked")}</Badge>}
                </span>
                {p.status === "ISSUED" && (
                  <LinkButton href={`/api/prescriptions/${p.id}/pdf`} variant="soft" size="sm" target="_blank" prefetch={false}>
                    {t("rx.openPdf")}
                  </LinkButton>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {canReview && (
        <section className="rounded-3xl border border-line bg-white p-5 shadow-card" data-testid="review-section">
          <h2 className="mb-1 font-semibold text-ink">{t("review.title")}</h2>
          {review ? (
            <div className="mt-2 space-y-2">
              <p className="inline-flex gap-0.5" aria-label={`${review.rating} / 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={clsx("h-5 w-5", i <= review.rating ? "fill-amber-400 text-amber-400" : "text-line-strong")} aria-hidden />
                ))}
              </p>
              {review.text && <p className="text-sm text-ink-soft">{review.text}</p>}
              <p className="text-xs text-muted">{t("review.yours")}</p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">{t("review.intro")}</p>
              <ReviewForm action={reviewAction} />
            </>
          )}
        </section>
      )}
      <section className="flex flex-col justify-between gap-4 rounded-3xl bg-brand-soft p-5">
        <div>
          <h2 className="font-semibold text-brand-dark">{t("consult.rebookTitle")}</h2>
          <p className="mt-1 text-sm text-brand-dark/80">{t("consult.rebookText")}</p>
        </div>
        <LinkButton href={`/${locale}/doctors/${doctorId}?service=consultation`} className="self-start" data-testid="rebook">
          <RotateCcw className="h-4 w-4" aria-hidden />
          {t("booking.rebook")}
        </LinkButton>
      </section>
    </div>
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
    <div className="rounded-3xl border border-line bg-white p-6 shadow-card">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
