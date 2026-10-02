import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarClock, EllipsisVertical, FileText, Scissors, UserX } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Chat } from "@/components/chat";
import { ConsultWorkspace } from "@/components/consult-workspace";
import { ConfirmSubmit, SubmitButton } from "@/components/forms";
import { Dropdown } from "@/components/menu";
import { PrescriptionEditor, type Favorite } from "@/components/prescription-editor";
import { revokeAndReplaceFormAction } from "@/actions/prescription";
import { StatusBadge } from "@/components/status";
import { Badge, Notice } from "@/components/ui";
import {
  answerRescheduleAction,
  endConsultationAction,
  markNoShowAction,
  orientConsultationAction,
} from "@/actions/consultation";
import { requireDoctor } from "@/lib/auth";
import { CHAT_OPENS_MINUTES_BEFORE, canMarkNoShow } from "@/lib/consultation-rules";
import { getConsultationForUser, loadMessages } from "@/lib/consultations";
import { db } from "@/lib/db";
import { defaultTemplateRef, templateOptions } from "@/lib/prescriptions";
import { formatDate, formatDateTime } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";

const QUICK_REPLIES = [1, 2, 3, 4, 5];

function age(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  return Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 3_600_000));
}

export default async function DoctorConsultationPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const { user, doctor } = await requireDoctor(locale);
  const found = await getConsultationForUser(id, user);
  if (!found || found.as !== "doctor") notFound();
  const { consultation: c, chat } = found;
  const patientName = `${c.patient.firstName} ${c.patient.lastName}`;
  const paid = ["PAID", "COMPLETED", "NO_SHOW"].includes(c.status);
  const [messages, issued, templates, history, operations, moveSlot, favorites, draft] = await Promise.all([
    paid ? loadMessages(c.id, user.id) : Promise.resolve([]),
    db.prescription.findMany({ where: { consultationId: c.id, status: "ISSUED" }, orderBy: { issuedAt: "asc" } }),
    templateOptions(doctor.id),
    db.consultation.findMany({
      where: { patientId: c.patientId, doctorId: doctor.id, id: { not: c.id }, status: { in: ["PAID", "COMPLETED", "NO_SHOW"] } },
      include: { slot: true, prescriptions: { where: { status: "ISSUED" }, select: { id: true, number: true } } },
      orderBy: { slot: { startsAt: "desc" } },
      take: 10,
    }),
    db.doctorOperation.count({ where: { doctorId: doctor.id } }),
    c.rescheduleSlotId ? db.slot.findUnique({ where: { id: c.rescheduleSlotId } }) : null,
    db.prescriptionFavorite.findMany({ where: { doctorId: doctor.id }, orderBy: { createdAt: "desc" } }),
    db.prescription.findFirst({ where: { consultationId: c.id, status: "DRAFT" }, include: { items: { orderBy: { position: "asc" } } } }),
  ]);
  const canPrescribe = c.status === "PAID" || c.status === "COMPLETED";
  const years = age(c.patient.birthDate);
  const subtitle = [years !== null ? t("workspace.age", { n: years }) : null, c.patient.country].filter(Boolean).join(" · ");
  const noShow = canMarkNoShow(c);

  const actions = c.status === "PAID" && (
    <>
      <form action={endConsultationAction.bind(null, locale, c.id)}>
        <ConfirmSubmit message={t("consult.endConfirm")} variant="primary" testId="consult-end">
          {t("workspace.end")}
        </ConfirmSubmit>
      </form>
      <Dropdown
        label={t("workspace.more")}
        testId="consult-menu"
        trigger={<EllipsisVertical className="h-5 w-5" aria-hidden />}
        width="w-64"
      >
        <form action={orientConsultationAction.bind(null, locale, c.id, "CLINIC")}>
          <MenuButton icon={<Building2 className="h-4 w-4" aria-hidden />}>{t("workspace.orientClinic")}</MenuButton>
        </form>
        {operations > 0 && (
          <form action={orientConsultationAction.bind(null, locale, c.id, "SURGERY")}>
            <MenuButton icon={<Scissors className="h-4 w-4" aria-hidden />}>{t("workspace.orientSurgery")}</MenuButton>
          </form>
        )}
        <form action={markNoShowAction.bind(null, locale, c.id)}>
          <MenuButton icon={<UserX className="h-4 w-4" aria-hidden />} disabled={!noShow} hint={noShow ? undefined : t("workspace.noShowLater")} testId="consult-noshow">
            {t("workspace.noShow")}
          </MenuButton>
        </form>
      </Dropdown>
    </>
  );

  const patientPanel = (
    <aside className="space-y-3" data-testid="patient-panel">
      <div className="rounded-3xl border border-line bg-white p-5 text-sm shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={c.status} t={t} />
          <span className="font-mono text-xs text-muted">{c.reference}</span>
        </div>
        <p className="mt-2 font-medium text-ink">{formatDateTime(c.slot.startsAt, locale)}</p>
        <p className="text-muted">{t("consult.minutes", { n: c.durationMinutes })}</p>
      </div>
      <div className="rounded-3xl border border-line bg-white p-5 shadow-card">
        <p className="font-semibold text-ink">{patientName}</p>
        <p className="text-sm text-muted">{subtitle || "—"}</p>
        {paid ? (
          <dl className="mt-3 space-y-1 text-sm">
            <div className="truncate text-ink-soft">{c.patient.email}</div>
            {c.patient.phone && <div className="text-ink-soft">{c.patient.phone}</div>}
          </dl>
        ) : (
          <p className="mt-3 text-xs text-muted">{t("workspace.contactsHidden")}</p>
        )}
      </div>
      {c.reason && (
        <div className="rounded-3xl border border-line bg-white p-5 text-sm shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("consult.reason")}</p>
          <p className="mt-2 whitespace-pre-wrap text-ink">{c.reason}</p>
        </div>
      )}
      <div className="rounded-3xl border border-line bg-white p-5 text-sm shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("workspace.history")}</p>
        {history.length === 0 ? (
          <p className="mt-2 text-muted">{t("workspace.firstVisit")}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/${locale}/doctor/consultations/${h.id}`} className="font-medium text-ink hover:underline">
                  {formatDate(h.slot.startsAt, locale)}
                </Link>
                {h.prescriptions.map((p) => (
                  <a key={p.id} href={`/api/prescriptions/${p.id}/pdf`} target="_blank" rel="noopener" className="ms-2 inline-flex items-center gap-1 text-xs text-brand-dark">
                    <FileText className="h-3 w-3" aria-hidden />
                    {p.number}
                  </a>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );

  const prescription = canPrescribe ? (
    // A card in the large-screen column; on phones the side panel already frames it.
    <section className="bg-white lg:rounded-3xl lg:border lg:border-line lg:p-5 lg:shadow-card">
      <h2 className="mb-4 hidden items-center gap-2 text-lg font-semibold text-ink lg:flex">
        <FileText className="h-5 w-5 text-brand" aria-hidden />
        {t("rx.title")}
      </h2>
      <PrescriptionEditor
        consultationId={c.id}
        hasStamp={!!doctor.stampImageId}
        templates={templates.map(({ ref, name }) => ({ ref, name }))}
        defaultTemplate={defaultTemplateRef(doctor)}
        favorites={favorites.map((f) => ({ id: f.id, name: f.name, items: f.items as Favorite["items"], notes: f.notes }))}
        initial={draft ? { items: draft.items, notes: draft.notes } : null}
        key={draft?.id ?? "new"}
      />
      <Link href={`/${locale}/doctor/prescription`} className="mt-3 inline-block text-xs font-medium text-muted underline">
        {t("rx.manageTemplates")}
      </Link>
      {issued.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
          {issued.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <a href={`/api/prescriptions/${p.id}/pdf`} target="_blank" rel="noopener" className="font-mono text-ink underline">
                  {p.number}
                </a>
                <span className="block text-xs text-muted">{p.issuedAt ? formatDateTime(p.issuedAt, locale) : ""}</span>
              </span>
              <form action={revokeAndReplaceFormAction.bind(null, locale, c.id, p.id)}>
                <ConfirmSubmit message={t("rx.replaceConfirm", { number: p.number ?? "" })} variant="ghost" testId="rx-replace">
                  {t("rx.replace")}
                </ConfirmSubmit>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  ) : null;

  return (
    <div className="space-y-4">
      {/* Once the chat exists its header names the patient: no second title above it. */}
      {!paid && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={`/${locale}/doctor/consultations`}
            aria-label={t("doctorArea.consultationsTitle")}
            className="-ms-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-surface"
          >
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-ink">{patientName}</h1>
          <StatusBadge status={c.status} t={t} />
          <span className="text-sm text-muted">
            {formatDateTime(c.slot.startsAt, locale)} · {t("consult.minutes", { n: c.durationMinutes })}
          </span>
          <span className="font-mono text-xs text-muted">{c.reference}</span>
        </div>
      )}

      {moveSlot && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4" data-testid="reschedule-request">
          <p className="flex items-center gap-2 text-sm text-ink">
            <CalendarClock className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            {t("workspace.rescheduleAsked", { date: formatDateTime(moveSlot.startsAt, locale) })}
          </p>
          <div className="flex gap-2">
            <form action={answerRescheduleAction.bind(null, locale, c.id, false)}>
              <SubmitButton variant="secondary" size="sm">
                {t("workspace.rescheduleRefuse")}
              </SubmitButton>
            </form>
            <form action={answerRescheduleAction.bind(null, locale, c.id, true)}>
              <SubmitButton size="sm" testId="reschedule-accept">
                {t("workspace.rescheduleAccept")}
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
      {c.status === "REQUESTED" && <Notice tone="info">{t("workspace.requestedNotice")}</Notice>}
      {c.status === "CONFIRMED" && <Notice tone="info">{t("consult.awaitingPayment")}</Notice>}
      {c.status === "NO_SHOW" && <Badge tone="amber">{t("workspace.noShowDone")}</Badge>}
      {chat === "waiting" && (
        <>
          <Notice tone="info">
            {t("consult.waitingText", { date: formatDateTime(c.slot.startsAt, locale), minutes: CHAT_OPENS_MINUTES_BEFORE })}
          </Notice>
          <AutoRefresh every={30000} times={120} />
        </>
      )}

      <ConsultWorkspace
        patient={patientPanel}
        prescription={prescription}
        chat={
          paid ? (
            <Chat
              consultationId={c.id}
              peerName={patientName}
              peerSubtitle={subtitle || undefined}
              initialMessages={messages}
              initialState={chat}
              quickReplies={QUICK_REPLIES.map((n) => t(`chat.quick.${n}`))}
              orientation={{ clinic: `${doctor.clinicName}, ${doctor.clinicAddress}`, surgeryHref: null }}
              headerActions={actions}
              backHref={`/${locale}/doctor/consultations`}
              fullscreenMobile={chat === "open"}
              className="md:h-[calc(100dvh-9rem)] md:min-h-[460px]"
            />
          ) : (
            // No chat yet, so no info icon: the patient file stays on the page.
            <div className="space-y-4">
              {patientPanel}
              <p className="rounded-3xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">{t("workspace.chatLater")}</p>
            </div>
          )
        }
      />
    </div>
  );
}

function MenuButton({
  children,
  icon,
  disabled,
  hint,
  testId,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  disabled?: boolean;
  hint?: string;
  testId?: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex min-h-11 w-full items-start gap-3 px-4 py-2.5 text-start text-sm hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
      data-testid={testId}
    >
      <span className="mt-0.5">{icon}</span>
      <span>
        {children}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}
