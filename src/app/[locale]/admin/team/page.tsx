import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Button, Card, Field, Input, PageTitle, Select, Table, Td, Th } from "@/components/ui";
import { inviteTeamMemberAction, toggleUserActiveAction } from "@/actions/admin";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, toLocale } from "@/lib/i18n";

export default async function AdminTeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const me = await requireRole(locale, ["ADMIN"]);
  const team = await db.user.findMany({ where: { role: { in: ["ADMIN", "AGENT"] } }, orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-10">
      <PageTitle title={t("admin.teamTitle")} subtitle={t("admin.teamSubtitle")} />
      <Table>
        <thead>
          <tr>
            <Th>{t("fields.name")}</Th>
            <Th>{t("fields.email")}</Th>
            <Th>{t("admin.role")}</Th>
            <Th>{t("admin.col.account")}</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {team.map((u) => (
            <tr key={u.id}>
              <Td>
                {u.firstName} {u.lastName}
              </Td>
              <Td>{u.email}</Td>
              <Td>{t(`roles.${u.role}`)}</Td>
              <Td>
                {!u.passwordHash ? (
                  <Badge tone="amber">{t("admin.invitePending")}</Badge>
                ) : u.active ? (
                  <Badge tone="green">{t("admin.active")}</Badge>
                ) : (
                  <Badge>{t("admin.inactive")}</Badge>
                )}
              </Td>
              <Td>
                {u.id !== me.id && (
                  <form action={toggleUserActiveAction.bind(null, locale, u.id)}>
                    <Button type="submit" size="sm" variant={u.active ? "danger" : "secondary"}>
                      {u.active ? t("admin.deactivate") : t("admin.activate")}
                    </Button>
                  </form>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Card>
        <h2 className="text-lg font-semibold text-ink">{t("admin.inviteMember")}</h2>
        <ActionForm action={inviteTeamMemberAction.bind(null, locale)} className="mt-5 grid gap-4 sm:grid-cols-2" resetOnSuccess>
          <Field label={t("fields.firstName")}>
            <Input name="firstName" required />
          </Field>
          <Field label={t("fields.lastName")}>
            <Input name="lastName" required />
          </Field>
          <Field label={t("fields.email")}>
            <Input type="email" name="email" required />
          </Field>
          <Field label={t("fields.phone")}>
            <Input name="phone" />
          </Field>
          <Field label={t("admin.role")}>
            <Select name="role" defaultValue="AGENT">
              <option value="AGENT">{t("roles.AGENT")}</option>
              <option value="ADMIN">{t("roles.ADMIN")}</option>
            </Select>
          </Field>
          <Field label={t("admin.doctor.accountLocale")}>
            <Select name="locale" defaultValue={locale}>
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>{t("admin.sendInvite")}</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
