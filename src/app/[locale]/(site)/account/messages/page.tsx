import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Avatar, Badge, Container, EmptyState, LinkButton, LiveDot, PageTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { chatState } from "@/lib/consultation-rules";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("nav.messages") };
}

/** Every conversation with a doctor, the live one first, with unread counts. */
export default async function MessagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const user = await requireRole(locale, ["PATIENT"], `/${locale}/account/messages`);
  const consultations = await db.consultation.findMany({
    where: { patientId: user.id, status: { in: ["PAID", "COMPLETED", "NO_SHOW"] } },
    include: {
      doctor: { include: { user: true, specialty_: true } },
      slot: true,
      // Automatic lines ("joined", "ended") are codes, not something to preview.
      messages: { where: { kind: { not: "SYSTEM" } }, orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: { where: { senderId: { not: user.id }, readAt: null } } } },
    },
    orderBy: { slot: { startsAt: "desc" } },
  });
  const rows = consultations
    .map((c) => ({ c, state: chatState(c), last: c.messages[0] ?? null }))
    .sort((a, b) => Number(b.state === "open") - Number(a.state === "open"));

  return (
    <Container className="max-w-3xl py-6 sm:py-10">
      <PageTitle title={t("nav.messages")} subtitle={t("messages.subtitle")} />
      {rows.length === 0 ? (
        <EmptyState icon={MessageCircle} title={t("messages.empty")} text={t("messages.emptyText")} action={<LinkButton href={`/${locale}/doctors`}>{t("home.ctaConsult")}</LinkButton>} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          {rows.map(({ c, state, last }) => (
            <li key={c.id}>
              <Link href={`/${locale}/account/consultations/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface" data-testid="conversation">
                <Avatar name={`${c.doctor.user.firstName} ${c.doctor.user.lastName}`} src={c.doctor.photoUrl} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    Dr {c.doctor.user.firstName} {c.doctor.user.lastName}
                  </p>
                  <p className="truncate text-sm text-muted" dir="auto">
                    {last
                      ? last.kind === "IMAGE"
                        ? t("chat.image")
                        : last.kind === "PRESCRIPTION"
                          ? t("chat.prescription")
                          : last.text
                      : c.doctor.specialty_
                        ? localized(c.doctor.specialty_, "name", locale)
                        : c.doctor.specialty}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-muted">{formatDateTime(last?.createdAt ?? c.slot.startsAt, locale)}</span>
                  {state === "open" ? (
                    <Badge tone="green">
                      <LiveDot />
                      {t("chat.live")}
                    </Badge>
                  ) : c._count.messages > 0 ? (
                    <span className="min-w-6 rounded-full bg-coral px-2 py-0.5 text-center text-xs font-bold text-white">{c._count.messages}</span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
