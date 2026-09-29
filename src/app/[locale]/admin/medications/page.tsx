import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/forms";
import { Card, Field, Input, PageTitle, Select, Table, Td, Th } from "@/components/ui";
import { createMedicationAction, deleteMedicationAction } from "@/actions/admin-reference";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, localized, toLocale } from "@/lib/i18n";
import { normalizeSearch } from "@/lib/search-text";

export default async function AdminMedicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const { q = "" } = await searchParams;
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const terms = normalizeSearch(q).split(" ").filter(Boolean);
  const [medications, total, specialties] = await Promise.all([
    db.medication.findMany({
      where: terms.length ? { AND: terms.map((term) => ({ searchText: { contains: term } })) } : {},
      include: { specialty: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    db.medication.count(),
    db.specialty.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <PageTitle title={t("admin.medicationsTitle")} subtitle={t("admin.medicationsSubtitle", { n: total })} />
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">{t("admin.addMedication")}</h2>
        <ActionForm action={createMedicationAction.bind(null, locale)} className="grid gap-4 sm:grid-cols-3">
          <Field label={t("admin.medication.name")}>
            <Input name="name" required />
          </Field>
          <Field label={t("admin.medication.dci")}>
            <Input name="dci" />
          </Field>
          <Field label={t("admin.medication.strength")}>
            <Input name="strength" placeholder="500 mg" />
          </Field>
          <Field label={t("admin.medication.form")}>
            <Input name="form" placeholder={t("admin.medication.formHint")} />
          </Field>
          <Field label={t("admin.specialty.name")}>
            <Select name="specialtyId" defaultValue="">
              <option value="">—</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {localized(s, "name", locale)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <SubmitButton className="w-full">{t("common.add")}</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <form className="flex gap-3" role="search">
        <Input name="q" defaultValue={q} placeholder={t("rx.search")} aria-label={t("rx.search")} />
        <SubmitButton variant="secondary">{t("common.search")}</SubmitButton>
      </form>

      <Table>
        <thead>
          <tr>
            <Th>{t("admin.medication.name")}</Th>
            <Th>{t("admin.medication.dci")}</Th>
            <Th>{t("admin.medication.form")}</Th>
            <Th>{t("admin.specialty.name")}</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {medications.map((m) => (
            <tr key={m.id} data-testid="medication-row">
              <Td>
                <span className="font-medium">{m.name}</span> <span className="text-muted">{m.strength}</span>
              </Td>
              <Td>{m.dci ?? "—"}</Td>
              <Td>{m.form ?? "—"}</Td>
              <Td>{m.specialty ? localized(m.specialty, "name", locale) : "—"}</Td>
              <Td>
                <form action={deleteMedicationAction.bind(null, locale, m.id)}>
                  <ConfirmSubmit message={t("admin.medication.deleteConfirm", { name: m.name })}>{t("common.delete")}</ConfirmSubmit>
                </form>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
