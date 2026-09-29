import { ActionForm, SubmitButton } from "@/components/forms";
import { SpecialtyIcon } from "@/components/specialty-icon";
import { Input, PageTitle, Table, Td, Th } from "@/components/ui";
import { updateSpecialtyAction } from "@/actions/admin-reference";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { centsToInput } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";

export default async function AdminSpecialtiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const specialties = await db.specialty.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { doctors: true, medications: true } } },
  });

  return (
    <div>
      <PageTitle title={t("admin.specialtiesTitle")} subtitle={t("admin.specialtiesSubtitle")} />
      <Table>
        <thead>
          <tr>
            <Th>{t("admin.specialty.name")}</Th>
            <Th>{t("admin.nav.doctors")}</Th>
            <Th>{t("admin.nav.medications")}</Th>
            <Th>{t("admin.specialty.price")}</Th>
          </tr>
        </thead>
        <tbody>
          {specialties.map((s) => (
            <tr key={s.id}>
              <Td>
                <span className="flex items-center gap-3">
                  <SpecialtyIcon name={s.icon} className="h-5 w-5 text-brand" aria-hidden />
                  <span>
                    <span className="block font-medium">{localized(s, "name", locale)}</span>
                    <span className="text-xs text-muted">{s.slug}</span>
                  </span>
                </span>
              </Td>
              <Td>{s._count.doctors}</Td>
              <Td>{s._count.medications}</Td>
              <Td>
                <ActionForm action={updateSpecialtyAction.bind(null, locale, s.id)} className="flex flex-wrap items-center gap-3">
                  <Input
                    name="consultationPrice"
                    inputMode="decimal"
                    defaultValue={centsToInput(s.consultationPrice)}
                    className="w-24"
                    aria-label={t("admin.specialty.price")}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={s.active} className="h-4 w-4 accent-brand" />
                    {t("admin.active")}
                  </label>
                  <SubmitButton size="sm" variant="secondary">
                    {t("common.save")}
                  </SubmitButton>
                </ActionForm>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
