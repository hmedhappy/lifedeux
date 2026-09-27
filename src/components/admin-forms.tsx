import type { Accommodation, Doctor, DoctorOperation, Operation, User } from "@prisma/client";
import type { ActionState } from "@/lib/action-state";
import { centsToInput } from "@/lib/format";
import { localized, type Locale, type TFunction } from "@/lib/i18n";
import { ActionForm, SubmitButton } from "./forms";
import { Field, Input, Select, Textarea } from "./ui";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

function Active({ t, defaultChecked }: { t: TFunction; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-3 text-sm font-medium text-ink">
      <input type="checkbox" name="active" defaultChecked={defaultChecked} className="h-4 w-4 accent-brand" />
      {t("admin.active")}
    </label>
  );
}

export function DoctorForm({
  action,
  t,
  locale,
  operations,
  doctor,
}: {
  action: Action;
  t: TFunction;
  locale: Locale;
  operations: Operation[];
  doctor?: Doctor & { user: User; operations: DoctorOperation[] };
}) {
  const offer = (id: string) => doctor?.operations.find((o) => o.operationId === id);
  return (
    <ActionForm action={action} className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t("fields.firstName")}>
          <Input name="firstName" defaultValue={doctor?.user.firstName} required />
        </Field>
        <Field label={t("fields.lastName")}>
          <Input name="lastName" defaultValue={doctor?.user.lastName} required />
        </Field>
        <Field label={t("fields.email")} hint={doctor ? t("admin.emailLocked") : t("admin.emailInviteHint")}>
          <Input type="email" name="email" defaultValue={doctor?.user.email} disabled={!!doctor} required={!doctor} />
        </Field>
        <Field label={t("fields.phone")}>
          <Input name="phone" defaultValue={doctor?.user.phone ?? ""} />
        </Field>
        <Field label={t("admin.doctor.specialty")}>
          <Input name="specialty" defaultValue={doctor?.specialty} required />
        </Field>
        <Field label={t("admin.doctor.years")}>
          <Input type="number" name="yearsOfExperience" min={0} max={70} defaultValue={doctor?.yearsOfExperience ?? 10} required />
        </Field>
        <Field label={t("admin.doctor.clinicName")}>
          <Input name="clinicName" defaultValue={doctor?.clinicName} required />
        </Field>
        <Field label={t("admin.doctor.city")}>
          <Input name="city" defaultValue={doctor?.city} required />
        </Field>
        <Field label={t("admin.doctor.clinicAddress")} className="sm:col-span-2">
          <Input name="clinicAddress" defaultValue={doctor?.clinicAddress} required />
        </Field>
        <Field label={t("admin.doctor.languages")} hint={t("admin.commaHint")}>
          <Input name="languages" defaultValue={doctor?.languages.join(", ") ?? "Français, العربية, English"} />
        </Field>
        <Field label={t("admin.doctor.accountLocale")}>
          <Select name="locale" defaultValue={doctor?.user.locale ?? locale}>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </Select>
        </Field>
        <Field label={t("admin.doctor.photo")} hint={t("admin.httpsHint")} className="sm:col-span-2">
          <Input type="url" name="photoUrl" defaultValue={doctor?.photoUrl ?? ""} placeholder="https://" />
        </Field>
        <Field label={t("admin.doctor.bio")} className="sm:col-span-2">
          <Textarea name="bio" rows={5} defaultValue={doctor?.bio} required />
        </Field>
      </section>

      <section>
        <h3 className="font-semibold text-ink">{t("admin.doctor.pricing")}</h3>
        <p className="mt-1 text-sm text-muted">{t("admin.doctor.pricingHint")}</p>
        <div className="mt-4 space-y-3">
          {operations.map((op) => (
            <div key={op.id} className="grid items-end gap-3 rounded-xl border border-line p-4 sm:grid-cols-[1fr_160px_160px]">
              <label className="flex items-center gap-3 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  name={`op_${op.id}`}
                  defaultChecked={doctor ? !!offer(op.id) : operations.length === 1}
                  className="h-4 w-4 accent-brand"
                />
                {localized(op, "name", locale)}
              </label>
              <Field label={t("admin.doctor.price")}>
                <Input name={`price_${op.id}`} inputMode="decimal" defaultValue={centsToInput(offer(op.id)?.price ?? op.basePrice)} />
              </Field>
              <Field label={t("admin.doctor.fee")}>
                <Input
                  name={`fee_${op.id}`}
                  inputMode="decimal"
                  defaultValue={centsToInput(offer(op.id)?.doctorFee ?? Math.round(op.basePrice * 0.6))}
                />
              </Field>
            </div>
          ))}
        </div>
      </section>

      {doctor && <Active t={t} defaultChecked={doctor.active && doctor.user.active} />}
      <SubmitButton size="lg">{doctor ? t("common.save") : t("admin.doctor.createAndInvite")}</SubmitButton>
    </ActionForm>
  );
}

export function OperationForm({ action, t, operation }: { action: Action; t: TFunction; operation?: Operation }) {
  return (
    <ActionForm action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("admin.operation.slug")} hint={t("admin.operation.slugHint")}>
          <Input name="slug" defaultValue={operation?.slug} pattern="[a-z0-9\-]{2,60}" required />
        </Field>
        <Field label={t("admin.operation.basePrice")}>
          <Input name="basePrice" inputMode="decimal" defaultValue={operation ? centsToInput(operation.basePrice) : ""} required />
        </Field>
        <Field label={t("admin.operation.recovery")}>
          <Input type="number" name="defaultRecoveryNights" min={1} max={60} defaultValue={operation?.defaultRecoveryNights ?? 7} required />
        </Field>
      </div>
      {(["Fr", "En", "Ar"] as const).map((l) => (
        <div key={l} className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-[240px_1fr]">
          <Field label={`${t("admin.operation.name")} (${l.toUpperCase()})`}>
            <Input name={`name${l}`} defaultValue={operation?.[`name${l}`]} dir={l === "Ar" ? "rtl" : undefined} required />
          </Field>
          <Field label={`${t("admin.operation.description")} (${l.toUpperCase()})`}>
            <Textarea
              name={`description${l}`}
              rows={3}
              defaultValue={operation?.[`description${l}`]}
              dir={l === "Ar" ? "rtl" : undefined}
              required
            />
          </Field>
        </div>
      ))}
      <Active t={t} defaultChecked={operation?.active ?? true} />
      <SubmitButton>{t("common.save")}</SubmitButton>
    </ActionForm>
  );
}

export function StayForm({ action, t, stay }: { action: Action; t: TFunction; stay?: Accommodation }) {
  return (
    <ActionForm action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("admin.stay.title")}>
          <Input name="title" defaultValue={stay?.title} required />
        </Field>
        <Field label={t("admin.stay.type")}>
          <Select name="type" defaultValue={stay?.type ?? "APARTMENT"}>
            <option value="APARTMENT">{t("accType.APARTMENT")}</option>
            <option value="HOUSE">{t("accType.HOUSE")}</option>
          </Select>
        </Field>
        <Field label={t("admin.stay.city")}>
          <Input name="city" defaultValue={stay?.city} required />
        </Field>
        <Field label={t("admin.stay.address")}>
          <Input name="address" defaultValue={stay?.address} required />
        </Field>
        <Field label={t("admin.stay.pricePerNight")}>
          <Input name="pricePerNight" inputMode="decimal" defaultValue={stay ? centsToInput(stay.pricePerNight) : ""} required />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("admin.stay.capacity")}>
            <Input type="number" name="capacity" min={1} max={30} defaultValue={stay?.capacity ?? 2} required />
          </Field>
          <Field label={t("admin.stay.bedrooms")}>
            <Input type="number" name="bedrooms" min={0} max={30} defaultValue={stay?.bedrooms ?? 1} required />
          </Field>
        </div>
        <Field label={t("admin.stay.amenities")} hint={t("admin.commaHint")} className="sm:col-span-2">
          <Input name="amenities" defaultValue={stay?.amenities.join(", ")} placeholder="Wi-Fi, Climatisation, Ascenseur" />
        </Field>
        <Field label={t("admin.stay.photos")} hint={t("admin.stay.photosHint")} className="sm:col-span-2">
          <Textarea name="photos" rows={3} defaultValue={stay?.photos.join("\n")} placeholder="https://…" />
        </Field>
        <Field label={t("admin.stay.description")} className="sm:col-span-2">
          <Textarea name="description" rows={4} defaultValue={stay?.description} required />
        </Field>
      </div>
      <Active t={t} defaultChecked={stay?.active ?? true} />
      <SubmitButton>{t("common.save")}</SubmitButton>
    </ActionForm>
  );
}
