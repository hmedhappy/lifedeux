import { redirect } from "next/navigation";
import { DoctorOnboarding } from "@/components/doctor-onboarding";
import { Container, Notice } from "@/components/ui";
import { completeDoctorOnboardingAction } from "@/actions/onboarding";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { db } from "@/lib/db";
import { findDoctorInvite } from "@/lib/doctor-invites";
import { getT, localized, toLocale } from "@/lib/i18n";
import { DEFAULT_CONSULTATION_FEE_RATIO } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("onboard.title"), robots: { index: false } };
}

/** Doctor sign-up from the link emailed by the admin: three short steps. */
export default async function OnboardPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: raw, token } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}${homeFor(user.role)}`);

  const invite = await findDoctorInvite(token);
  const [specialties, settings] = invite
    ? await Promise.all([db.specialty.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { nameFr: "asc" }] }), getSettings()])
    : [[], null];

  return (
    <Container className="flex justify-center py-8 sm:py-14">
      <div className="w-full max-w-xl animate-fade-in">
        {!invite || !settings ? (
          <Notice tone="error">{t("onboard.invalid")}</Notice>
        ) : (
          <div className="rounded-3xl border border-line bg-white p-5 shadow-card sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{t("onboard.title")}</h1>
            <p className="mt-1 mb-6 text-muted">{t("onboard.subtitle")}</p>
            <DoctorOnboarding
              action={completeDoctorOnboardingAction.bind(null, locale, token)}
              email={invite.email}
              specialties={specialties.map((s) => ({ id: s.id, name: localized(s, "name", locale) }))}
              currency={settings.currency}
              onlineShare={Math.round(DEFAULT_CONSULTATION_FEE_RATIO * 100)}
            />
          </div>
        )}
      </div>
    </Container>
  );
}
