import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Chat } from "@/components/chat";
import { ConfirmSubmit } from "@/components/forms";
import { PrescriptionEditor } from "@/components/prescription-editor";
import { StatusBadge } from "@/components/status";
import { Notice } from "@/components/ui";
import { endConsultationAction } from "@/actions/consultation";
import { requireDoctor } from "@/lib/auth";
import { CHAT_OPENS_MINUTES_BEFORE } from "@/lib/consultation-rules";
import { getConsultationForUser, loadMessages } from "@/lib/consultations";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";

export default async function DoctorConsultationPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const { user, doctor } = await requireDoctor(locale);
  const found = await getConsultationForUser(id, user);
  if (!found || found.as !== "doctor") notFound();
  const { consultation: c, chat } = found;
  const patientName = `${c.patient.firstName} ${c.patient.lastName}`;
  const [messages, issued] = await Promise.all([
    c.status === "PAID" || c.status === "COMPLETED" ? loadMessages(c.id, user.id) : Promise.resolve([]),
    db.prescription.findMany({ where: { consultationId: c.id, status: "ISSUED" }, orderBy: { issuedAt: "asc" } }),
  ]);
  const canPrescribe = c.status === "PAID" || c.status === "COMPLETED";
  const subtitle = [c.patient.country, c.patient.birthDate ? formatDate(c.patient.birthDate, locale) : null].filter(Boolean).join(" · ");

  const side = (
    <aside className="w-full space-y-6 lg:w-[400px]">
      {c.reason && (
        <div className="rounded-2xl border border-line p-5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("consult.reason")}</p>
          <p className="mt-2 whitespace-pre-wrap text-ink">{c.reason}</p>
        </div>
      )}
      {canPrescribe && (
        <section className="rounded-2xl border border-line p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-ink">
            <FileText className="h-5 w-5 text-brand" aria-hidden />
            {t("rx.title")}
          </h2>
          <PrescriptionEditor consultationId={c.id} hasStamp={!!doctor.stampImageId} />
          {issued.length > 0 && (
            <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
              {issued.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <a href={`/api/prescriptions/${p.id}/pdf`} target="_blank" rel="noopener" className="font-mono text-ink underline">
                    {p.number}
                  </a>
                  <span className="text-muted">{p.issuedAt ? formatDateTime(p.issuedAt, locale) : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {c.status === "PAID" && (
        <form action={endConsultationAction.bind(null, locale, c.id)}>
          <ConfirmSubmit message={t("consult.endConfirm")}>{t("consult.end")}</ConfirmSubmit>
        </form>
      )}
    </aside>
  );

  return (
    <div className="space-y-6">
      <Link href={`/${locale}/doctor/consultations`} className="text-sm font-medium text-ink underline">
        ← {t("doctorArea.consultationsTitle")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{patientName}</h1>
        <StatusBadge status={c.status} t={t} />
        <span className="font-mono text-sm text-muted">{c.reference}</span>
      </div>
      <p className="text-muted">
        {formatDateTime(c.slot.startsAt, locale)} · {t("consult.minutes", { n: c.durationMinutes })}
      </p>
      {c.status === "CONFIRMED" && <Notice tone="info">{t("consult.awaitingPayment")}</Notice>}
      {chat === "waiting" && (
        <>
          <Notice tone="info">
            {t("consult.waitingText", { date: formatDateTime(c.slot.startsAt, locale), minutes: CHAT_OPENS_MINUTES_BEFORE })}
          </Notice>
          <AutoRefresh every={30000} times={120} />
        </>
      )}
      {canPrescribe ? (
        <Chat
          consultationId={c.id}
          peerName={patientName}
          peerSubtitle={subtitle || undefined}
          initialMessages={messages}
          initialState={chat}
          side={side}
        />
      ) : (
        side
      )}
    </div>
  );
}
