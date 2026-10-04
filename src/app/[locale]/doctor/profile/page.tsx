import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Field, Input, Notice, PageTitle, Textarea } from "@/components/ui";
import { updateDoctorProfileAction } from "@/actions/doctor-settings";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { centsToInput, formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("doctorProfile.title") };
}

export default async function DoctorProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { doctor: me } = await requireDoctor(locale);
  const [doctor, settings] = await Promise.all([
    db.doctor.findUniqueOrThrow({ where: { id: me.id }, include: { user: true, specialty_: true } }),
    getSettings(),
  ]);
  const price = doctor.consultationPrice ?? doctor.specialty_?.consultationPrice ?? null;

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle
        title={t("doctorProfile.title")}
        subtitle={t("doctorProfile.subtitle")}
        action={
          <Link href={`/${locale}/doctors/${doctor.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-dark" target="_blank">
            {t("doctorProfile.seePublic")}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        }
      />
      <ActionForm action={updateDoctorProfileAction.bind(null, locale)} className="space-y-6">
        <section className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-4">
            <Avatar name={`${doctor.user.firstName} ${doctor.user.lastName}`} src={doctor.photoUrl} size={72} />
            <div className="min-w-0">
              <p className="font-semibold text-ink">
                Dr {doctor.user.firstName} {doctor.user.lastName}
              </p>
              <p className="text-sm text-muted">{doctor.specialty_ ? localized(doctor.specialty_, "name", locale) : doctor.specialty}</p>
            </div>
          </div>
          <Field label={t("doctorProfile.photo")} hint={t("doctorProfile.photoHint")}>
            <Input type="file" name="photoFile" accept="image/jpeg,image/png,image/webp" />
          </Field>
          <Field label={t("admin.doctor.bio")}>
            <Textarea name="bio" rows={5} maxLength={4000} defaultValue={doctor.bio} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin.doctor.languages")} hint={t("doctorProfile.languagesHint")}>
              <Input name="languages" defaultValue={doctor.languages.join(", ")} />
            </Field>
            <Field label={t("admin.doctor.years")}>
              <Input type="number" name="yearsOfExperience" min={0} max={70} defaultValue={doctor.yearsOfExperience} />
            </Field>
            <Field label={t("admin.doctor.clinicName")}>
              <Input name="clinicName" defaultValue={doctor.clinicName} />
            </Field>
            <Field label={t("admin.doctor.city")}>
              <Input name="city" defaultValue={doctor.city} />
            </Field>
          </div>
          <Field label={t("admin.doctor.clinicAddress")}>
            <Input name="clinicAddress" defaultValue={doctor.clinicAddress} />
          </Field>
        </section>

        <section className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6">
          <h2 className="font-semibold text-ink">{t("doctorProfile.consultation")}</h2>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="offersConsultation" defaultChecked={doctor.offersConsultation} className="mt-1 h-4 w-4 accent-brand" />
            <span>
              <span className="block font-medium text-ink">{t("doctorProfile.offers")}</span>
              <span className="text-muted">{t("doctorProfile.offersHint")}</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="instantBooking" defaultChecked={doctor.instantBooking} className="mt-1 h-4 w-4 accent-brand" data-testid="instant-booking" />
            <span>
              <span className="block font-medium text-ink">{t("doctorProfile.instant")}</span>
              <span className="text-muted">{t("doctorProfile.instantHint")}</span>
            </span>
          </label>
          <Field label={t("doctorProfile.price", { currency: settings.currency })} hint={t("doctorProfile.priceHint")}>
            <Input name="consultationPrice" inputMode="decimal" defaultValue={price ? centsToInput(price) : ""} />
          </Field>
          {doctor.pendingConsultationPrice && (
            <Notice tone="info">{t("doctorProfile.pricePending", { price: formatMoney(doctor.pendingConsultationPrice, settings.currency, locale) })}</Notice>
          )}
        </section>
        <section className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6">
          <h2 className="font-semibold text-ink">{t("doctorProfile.inPerson")}</h2>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="offersInPerson" defaultChecked={doctor.offersInPerson} className="mt-1 h-4 w-4 accent-brand" />
            <span>
              <span className="block font-medium text-ink">{t("doctorProfile.inPersonOffers")}</span>
              <span className="text-muted">{t("onboard.priceClinicHint")}</span>
            </span>
          </label>
          <Field label={t("doctorProfile.inPersonPrice", { currency: settings.currency })}>
            <Input name="inPersonPrice" inputMode="decimal" defaultValue={doctor.inPersonPrice ? centsToInput(doctor.inPersonPrice) : ""} />
          </Field>
        </section>
        <SubmitButton size="lg" testId="doctor-profile-save">
          {t("doctorProfile.save")}
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
