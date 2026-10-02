import { redirect } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { StepFields } from "@/components/step-fields";
import { Avatar, Container, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { joinAsDoctorAction } from "@/actions/auth";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, localized, toLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("referral.joinTitle"), robots: { index: false } };
}

const fileClass =
  "block w-full text-sm text-muted file:me-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-surface";

export default async function JoinPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale: raw, code } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}${homeFor(user.role)}`);

  const referrer = await db.doctor.findFirst({
    where: { referralCode: code, active: true, user: { role: "SUPER_DOCTOR", active: true } },
    include: { user: true, specialty_: true },
  });
  const specialties = referrer ? await db.specialty.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }) : [];

  return (
    <Container className="flex justify-center py-14">
      <div className="w-full max-w-2xl">
        {!referrer ? (
          <Notice tone="error">{t("errors.referralInvalid")}</Notice>
        ) : (
          <>
            <div className="flex items-center gap-4 rounded-2xl bg-surface p-5">
              <Avatar name={`${referrer.user.firstName} ${referrer.user.lastName}`} src={referrer.photoUrl} size={56} />
              <div>
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  <BadgeCheck className="h-4 w-4 text-brand" aria-hidden />
                  {t("referral.invitedBy")}
                </p>
                <p className="font-semibold text-ink">
                  Dr {referrer.user.firstName} {referrer.user.lastName}
                </p>
                {referrer.specialty_ && <p className="text-sm text-muted">{localized(referrer.specialty_, "name", locale)}</p>}
              </div>
            </div>
            <div className="mt-6 rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
              <h1 className="text-2xl font-semibold text-ink">{t("referral.joinTitle")}</h1>
              <p className="mt-1 text-muted">{t("referral.joinSubtitle")}</p>
              <ActionForm action={joinAsDoctorAction.bind(null, locale, code)} className="mt-8">
                <StepFields
                  steps={[
                    {
                      title: t("referral.stepAccount"),
                      content: (
                        <>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label={t("fields.firstName")} hint={t("fields.latinHint")}>
                              <Input name="firstName" autoComplete="given-name" required />
                            </Field>
                            <Field label={t("fields.lastName")}>
                              <Input name="lastName" autoComplete="family-name" required />
                            </Field>
                            <Field label={t("fields.email")}>
                              <Input type="email" name="email" autoComplete="email" required />
                            </Field>
                            <Field label={t("fields.phone")}>
                              <Input type="tel" name="phone" autoComplete="tel" required />
                            </Field>
                          </div>
                          <Field label={t("fields.password")} hint={t("fields.passwordHint")}>
                            <Input type="password" name="password" autoComplete="new-password" minLength={8} required />
                          </Field>
                          <label className="flex items-start gap-3 text-sm text-ink">
                            <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 accent-brand" />
                            <span>{t("referral.consent")}</span>
                          </label>
                        </>
                      ),
                    },
                    {
                      title: t("referral.stepPractice"),
                      content: (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label={t("admin.doctor.specialtyCategory")}>
                            <Select name="specialtyId" defaultValue="" required>
                              <option value="" disabled>
                                —
                              </option>
                              {specialties.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {localized(s, "name", locale)}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field label={t("admin.doctor.specialty")} hint={t("admin.doctor.specialtyHint")}>
                            <Input name="specialty" required />
                          </Field>
                          <Field label={t("admin.doctor.license")}>
                            <Input name="licenseNumber" required />
                          </Field>
                          <Field label={t("admin.doctor.city")}>
                            <Input name="city" required />
                          </Field>
                          <Field label={t("admin.doctor.clinicName")}>
                            <Input name="clinicName" required />
                          </Field>
                          <Field label={t("admin.doctor.clinicAddress")}>
                            <Input name="clinicAddress" required />
                          </Field>
                          <Field label={t("admin.doctor.bio")} className="sm:col-span-2">
                            <Textarea name="bio" rows={3} />
                          </Field>
                          <Field label={t("admin.doctor.stamp")} hint={t("referral.stampHint")}>
                            <input type="file" name="stampFile" accept="image/png,image/jpeg" className={fileClass} />
                          </Field>
                          <Field label={t("admin.doctor.signature")}>
                            <input type="file" name="signatureFile" accept="image/png,image/jpeg" className={fileClass} />
                          </Field>
                        </div>
                      ),
                    },
                  ]}
                  submit={
                    <SubmitButton size="lg" className="w-full">
                      {t("referral.joinButton")}
                    </SubmitButton>
                  }
                />
              </ActionForm>
            </div>
          </>
        )}
      </div>
    </Container>
  );
}
