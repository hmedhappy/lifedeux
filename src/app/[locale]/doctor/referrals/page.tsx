import { redirect } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Avatar, Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { appUrl } from "@/lib/settings";

export default async function ReferralsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { user, doctor } = await requireDoctor(locale);
  if (user.role !== "SUPER_DOCTOR" || !doctor.referralCode) redirect(`/${locale}/doctor`);

  const link = `${appUrl()}/${locale}/join/${doctor.referralCode}`;
  const referrals = await db.doctor.findMany({
    where: { referredById: doctor.id },
    include: { user: true, specialty_: true, _count: { select: { consultations: { where: { status: "COMPLETED" } } } } },
    orderBy: { createdAt: "desc" },
  });
  const share = encodeURIComponent(t("referral.shareText", { link }));

  return (
    <div className="space-y-10">
      <PageTitle title={t("referral.title")} subtitle={t("referral.subtitle")} />
      <Card>
        <p className="text-sm font-medium text-ink">{t("referral.yourLink")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="min-w-0 flex-1 truncate rounded-xl bg-surface px-4 py-3 text-sm" data-testid="referral-link">
            {link}
          </code>
          <CopyButton value={link} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <a className="font-medium text-ink underline" href={`https://wa.me/?text=${share}`} target="_blank" rel="noopener">
            WhatsApp
          </a>
          <a className="font-medium text-ink underline" href={`mailto:?subject=${encodeURIComponent(t("referral.joinTitle"))}&body=${share}`}>
            {t("fields.email")}
          </a>
        </div>
        <p className="mt-4 text-xs text-muted">{t("referral.code", { code: doctor.referralCode })}</p>
      </Card>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">{t("referral.listTitle", { n: referrals.length })}</h2>
        {referrals.length === 0 ? (
          <EmptyState title={t("referral.empty")} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white shadow-card">
            {referrals.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-4" data-testid="referral-row">
                <Avatar name={`${r.user.firstName} ${r.user.lastName}`} src={r.photoUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">
                    Dr {r.user.firstName} {r.user.lastName}
                  </p>
                  <p className="text-sm text-muted">
                    {r.specialty_ ? localized(r.specialty_, "name", locale) : r.specialty} · {r.city}
                  </p>
                </div>
                <span className="text-sm text-muted">{t("referral.joined", { date: formatDate(r.createdAt, locale) })}</span>
                <Badge tone="blue">{t("referral.consultations", { n: r._count.consultations })}</Badge>
                {r.active && r.user.active ? <Badge tone="green">{t("admin.active")}</Badge> : <Badge>{t("admin.inactive")}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
