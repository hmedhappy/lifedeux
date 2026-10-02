import { BadgeCheck, ShieldAlert } from "lucide-react";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/forms";
import { TemplateForm } from "@/components/template-form";
import { Badge, Button, Card, Field, Input, PageTitle } from "@/components/ui";
import { uploadSignaturesAction } from "@/actions/doctor";
import { deleteFavoriteAction } from "@/actions/prescription";
import { createTemplateAction, deleteTemplateAction, setDefaultTemplateAction } from "@/actions/prescription-template";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, toLocale } from "@/lib/i18n";
import { defaultTemplateRef, doctorSheet, renderPreviewSvg, resolveTemplate, templateOptions } from "@/lib/prescriptions";
import { sampleSheet } from "@/lib/rx-sheet";

export default async function PrescriptionTemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { doctor: base } = await requireDoctor(locale);
  const doctor = await db.doctor.findUniqueOrThrow({ where: { id: base.id }, include: { user: true, specialty_: true } });
  const current = defaultTemplateRef(doctor);
  const sample = sampleSheet(doctorSheet(doctor));
  const [options, favorites] = await Promise.all([
    templateOptions(doctor.id),
    db.prescriptionFavorite.findMany({ where: { doctorId: doctor.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const cards = await Promise.all(
    options.map(async (o) => ({ ...o, svg: await renderPreviewSvg(sample, await resolveTemplate(o.ref, doctor.id), doctor) })),
  );

  return (
    <div className="space-y-10">
      <PageTitle title={t("rxTemplates.title")} subtitle={t("rxTemplates.subtitle")} />

      <section id="stamp" className="scroll-mt-24 rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6">
        <h2 className="text-lg font-semibold text-ink">{t("rxTemplates.signaturesTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("rxTemplates.signaturesText")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <StatusLine
            ok={!!doctor.stampImageId}
            label={t("admin.doctor.stamp")}
            text={doctor.pendingStampImageId ? t("rxTemplates.stampPending") : doctor.stampImageId ? t("rxTemplates.saved") : t("rxTemplates.missing")}
            testId="stamp-status"
          />
          <StatusLine ok={!!doctor.signatureImageId} label={t("admin.doctor.signature")} text={doctor.signatureImageId ? t("rxTemplates.saved") : t("rxTemplates.missing")} />
        </div>
        <ActionForm action={uploadSignaturesAction.bind(null, locale)} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label={t("rxTemplates.stampFile")} hint={t("rxTemplates.stampHint")}>
            <Input type="file" name="stampFile" accept="image/png,image/jpeg" data-testid="stamp-file" />
          </Field>
          <Field label={t("rxTemplates.signatureFile")}>
            <Input type="file" name="signatureFile" accept="image/png,image/jpeg" />
          </Field>
          <SubmitButton testId="stamp-submit">{t("rxTemplates.upload")}</SubmitButton>
        </ActionForm>
      </section>

      {favorites.length > 0 && (
        <section className="rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6" data-testid="favorites">
          <h2 className="text-lg font-semibold text-ink">{t("rx.favoritesTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("rx.favoritesText")}</p>
          <ul className="mt-4 divide-y divide-line">
            {favorites.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-3">
                <span>
                  <span className="block font-medium text-ink">{f.name}</span>
                  <span className="block text-xs text-muted">{t("documents.items", { n: Array.isArray(f.items) ? f.items.length : 0 })}</span>
                </span>
                <form action={deleteFavoriteAction.bind(null, f.id)}>
                  <ConfirmSubmit message={t("rx.favoriteDeleteConfirm", { name: f.name })}>{t("rxTemplates.delete")}</ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <li key={c.ref} className="flex flex-col rounded-2xl border border-line bg-white p-4" data-testid="rx-template">
            <div
              className="overflow-hidden rounded-lg border border-line shadow-sm [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
              aria-label={c.name}
              dangerouslySetInnerHTML={{ __html: c.svg }}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="text-xs text-muted">{t(`rxTemplates.layout.${c.layout}`)}</p>
              </div>
              {c.ref === current && <Badge tone="green">{t("rxTemplates.default")}</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.ref !== current && (
                <form action={setDefaultTemplateAction.bind(null, locale, c.ref)}>
                  <Button type="submit" size="sm" variant="secondary">
                    {t("rxTemplates.useDefault")}
                  </Button>
                </form>
              )}
              {!c.builtin && (
                <form action={deleteTemplateAction.bind(null, locale, c.ref)}>
                  <ConfirmSubmit message={t("rxTemplates.deleteConfirm", { name: c.name })}>{t("common.delete")}</ConfirmSubmit>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Card>
        <h2 className="text-lg font-semibold text-ink">{t("rxTemplates.newTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("rxTemplates.newHint")}</p>
        <ActionForm action={createTemplateAction.bind(null, locale)} className="mt-6 space-y-5">
          <TemplateForm />
          <SubmitButton>{t("rxTemplates.create")}</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}

function StatusLine({ ok, label, text, testId }: { ok: boolean; label: string; text: string; testId?: string }) {
  return (
    <p
      className={`flex items-center gap-2 rounded-2xl border p-4 text-sm ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
      data-testid={testId}
    >
      {ok ? <BadgeCheck className="h-5 w-5 shrink-0" aria-hidden /> : <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden />}
      <span>
        <span className="font-semibold">{label}</span> · {text}
      </span>
    </p>
  );
}
