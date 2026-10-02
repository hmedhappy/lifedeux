import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, PageTitle, Textarea } from "@/components/ui";
import { importDoctorsAction } from "@/actions/admin";
import { importMedicationsAction } from "@/actions/admin-reference";
import { requireRole } from "@/lib/auth";
import { getT, toLocale } from "@/lib/i18n";

const MEDICATION_COLUMNS = "name;dci;form;strength;specialty";
const DOCTOR_COLUMNS = "first_name;last_name;email;phone;specialty_slug;specialty;license;city;clinic_name;clinic_address;locale";

/** CSV imports, in the recommended order: medications first, then doctors. */
export default async function AdminImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const steps = [
    { n: 1, title: t("import.medicationsTitle"), text: t("import.medicationsText"), columns: MEDICATION_COLUMNS, action: importMedicationsAction.bind(null, locale), testId: "import-medications" },
    { n: 2, title: t("import.doctorsTitle"), text: t("import.doctorsText"), columns: DOCTOR_COLUMNS, action: importDoctorsAction.bind(null, locale), testId: "import-doctors" },
  ];
  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle title={t("import.title")} subtitle={t("import.subtitle")} />
      {steps.map((s) => (
        <section key={s.n} className="rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6" data-testid={s.testId}>
          <h2 className="flex items-center gap-3 text-lg font-semibold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-dark">{s.n}</span>
            {s.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{s.text}</p>
          <p className="mt-3 overflow-x-auto rounded-xl bg-surface px-3 py-2 font-mono text-xs text-ink-soft">{s.columns}</p>
          <ActionForm action={s.action} className="mt-4 space-y-3">
            <Field label={t("import.file")}>
              <Input type="file" name="file" accept=".csv,text/csv,text/plain" />
            </Field>
            <Field label={t("import.paste")}>
              <Textarea name="csv" rows={4} placeholder={s.columns} className="font-mono text-xs" />
            </Field>
            <SubmitButton>{t("import.run")}</SubmitButton>
          </ActionForm>
        </section>
      ))}
    </div>
  );
}
