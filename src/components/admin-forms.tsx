import type {
  Accommodation,
  Doctor,
  DoctorOperation,
  Operation,
  Specialty,
  User,
} from "@prisma/client";
import type { ActionState } from "@/lib/action-state";
import { centsToInput } from "@/lib/format";
import { localized, type Locale, type TFunction } from "@/lib/i18n";
import { ActionForm, SubmitButton } from "./forms";
import { StepFields } from "./step-fields";
import { Field, Input, Select, Textarea } from "./ui";
import { ImageInput } from "./image-input";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

function Active({
  t,
  defaultChecked,
}: {
  t: TFunction;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-3 text-sm font-medium text-ink">
      <input
        type="checkbox"
        name="active"
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-brand"
      />
      {t("admin.active")}
    </label>
  );
}

export function DoctorForm({
  action,
  t,
  locale,
  operations,
  specialties,
  doctor,
}: {
  action: Action;
  t: TFunction;
  locale: Locale;
  operations: Operation[];
  specialties: Specialty[];
  doctor?: Doctor & { user: User; operations: DoctorOperation[] };
}) {
  const offer = (id: string) =>
    doctor?.operations.find((o) => o.operationId === id);
  const submit = (
    <SubmitButton size="lg">
      {doctor ? t("common.save") : t("admin.doctor.createAndInvite")}
    </SubmitButton>
  );
  const identity = (
    <>
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t("fields.firstName")} hint={t("fields.latinHint")}>
          <Input
            name="firstName"
            defaultValue={doctor?.user.firstName}
            required
          />
        </Field>
        <Field label={t("fields.lastName")}>
          <Input
            name="lastName"
            defaultValue={doctor?.user.lastName}
            required
          />
        </Field>
        <Field
          label={t("fields.email")}
          hint={doctor ? t("admin.emailLocked") : t("admin.emailInviteHint")}
        >
          <Input
            type="email"
            name="email"
            defaultValue={doctor?.user.email}
            disabled={!!doctor}
            required={!doctor}
          />
        </Field>
        <Field label={t("fields.phone")}>
          <Input name="phone" defaultValue={doctor?.user.phone ?? ""} />
        </Field>
        <Field label={t("admin.doctor.specialtyCategory")}>
          <Select
            name="specialtyId"
            defaultValue={doctor?.specialtyId ?? ""}
            required
            data-testid="specialty-select"
          >
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
        <Field
          label={t("admin.doctor.specialty")}
          hint={t("admin.doctor.specialtyHint")}
        >
          <Input name="specialty" defaultValue={doctor?.specialty} required />
        </Field>
        <Field label={t("admin.doctor.license")}>
          <Input
            name="licenseNumber"
            defaultValue={doctor?.licenseNumber ?? ""}
          />
        </Field>
        <Field label={t("admin.doctor.years")}>
          <Input
            type="number"
            name="yearsOfExperience"
            min={0}
            max={70}
            defaultValue={doctor?.yearsOfExperience ?? 10}
            required
          />
        </Field>
        <Field label={t("admin.doctor.clinicName")}>
          <Input name="clinicName" defaultValue={doctor?.clinicName} required />
        </Field>
        <Field label={t("admin.doctor.city")}>
          <Input name="city" defaultValue={doctor?.city} required />
        </Field>
        <Field
          label={t("admin.doctor.clinicAddress")}
          className="sm:col-span-2"
        >
          <Input
            name="clinicAddress"
            defaultValue={doctor?.clinicAddress}
            required
          />
        </Field>
        <Field label={t("admin.doctor.languages")} hint={t("admin.commaHint")}>
          <Input
            name="languages"
            defaultValue={
              doctor?.languages.join(", ") ?? "Français, العربية, English"
            }
          />
        </Field>
        <Field label={t("admin.doctor.accountLocale")}>
          <Select name="locale" defaultValue={doctor?.user.locale ?? locale}>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </Select>
        </Field>
        <Field
          label={t("admin.doctor.photoUpload")}
          hint={t("admin.photoUploadHint")}
        >
          <ImageInput name="photoFile" />
        </Field>
        <Field label={t("admin.doctor.photo")} hint={t("admin.httpsHint")}>
          <Input
            name="photoUrl"
            defaultValue={doctor?.photoUrl ?? ""}
            placeholder="https://"
          />
        </Field>
        <Field label={t("admin.doctor.bio")} className="sm:col-span-2">
          <Textarea name="bio" rows={5} defaultValue={doctor?.bio} required />
        </Field>
      </section>
    </>
  );
  const pricing = (
    <>
      <section>
        <h3 className="font-semibold text-ink">{t("admin.doctor.pricing")}</h3>
        <p className="mt-1 text-sm text-muted">
          {t("admin.doctor.pricingHint")}
        </p>
        <div className="mt-4 space-y-3">
          {operations.map((op) => (
            <div
              key={op.id}
              className="grid items-end gap-3 rounded-xl border border-line p-4 sm:grid-cols-[1fr_160px_160px]"
            >
              <label className="flex items-center gap-3 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  name={`op_${op.id}`}
                  defaultChecked={
                    doctor ? !!offer(op.id) : operations.length === 1
                  }
                  className="h-4 w-4 accent-brand"
                />
                {localized(op, "name", locale)}
              </label>
              <Field label={t("admin.doctor.price")}>
                <Input
                  name={`price_${op.id}`}
                  inputMode="decimal"
                  defaultValue={centsToInput(
                    offer(op.id)?.price ?? op.basePrice,
                  )}
                />
              </Field>
              <Field label={t("admin.doctor.fee")}>
                <Input
                  name={`fee_${op.id}`}
                  inputMode="decimal"
                  defaultValue={centsToInput(
                    offer(op.id)?.doctorFee ?? Math.round(op.basePrice * 0.6),
                  )}
                />
              </Field>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-ink">
          {t("admin.doctor.consultation")}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {t("admin.doctor.consultationHint")}
        </p>
        <div className="mt-4 grid items-end gap-3 rounded-xl border border-line p-4 sm:grid-cols-[1fr_140px_140px_120px]">
          <label className="flex items-center gap-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              name="offersConsultation"
              defaultChecked={doctor?.offersConsultation ?? true}
              className="h-4 w-4 accent-brand"
            />
            {t("admin.doctor.offersConsultation")}
          </label>
          <Field label={t("admin.doctor.price")}>
            <Input
              name="consultationPrice"
              inputMode="decimal"
              defaultValue={
                doctor?.consultationPrice != null
                  ? centsToInput(doctor.consultationPrice)
                  : ""
              }
              placeholder={t("admin.doctor.defaultPrice")}
            />
          </Field>
          <Field label={t("admin.doctor.fee")}>
            <Input
              name="consultationFee"
              inputMode="decimal"
              defaultValue={
                doctor?.consultationFee != null
                  ? centsToInput(doctor.consultationFee)
                  : ""
              }
              placeholder="70 %"
            />
          </Field>
          <Field label={t("admin.doctor.minutes")}>
            <Input
              type="number"
              name="consultationMinutes"
              min={10}
              max={120}
              defaultValue={doctor?.consultationMinutes ?? 30}
            />
          </Field>
        </div>
      </section>
    </>
  );
  const signatures = (
    <>
      <section>
        <h3 className="font-semibold text-ink">
          {t("admin.doctor.signatureTitle")}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {t("admin.doctor.signatureHint")}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(["stamp", "signature"] as const).map((kind) => {
            const has =
              kind === "stamp"
                ? doctor?.stampImageId
                : doctor?.signatureImageId;
            return (
              <Field
                key={kind}
                label={t(`admin.doctor.${kind}`)}
                hint={has ? t("admin.doctor.replaceHint") : undefined}
              >
                {has && doctor && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/doctors/${doctor.id}/${kind}`}
                    alt={t(`admin.doctor.${kind}`)}
                    className="mb-2 h-20 w-auto rounded-lg border border-line bg-white object-contain p-1"
                  />
                )}
                <input
                  type="file"
                  name={`${kind}File`}
                  accept="image/png,image/jpeg"
                  data-testid={`${kind}-file`}
                  className="block w-full text-sm text-muted file:me-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-surface"
                />
              </Field>
            );
          })}
        </div>
      </section>

      <label className="flex items-start gap-3 rounded-xl border border-line p-4 text-sm text-ink">
        <input
          type="checkbox"
          name="superDoctor"
          defaultChecked={doctor?.user.role === "SUPER_DOCTOR"}
          className="mt-0.5 h-4 w-4 accent-brand"
        />
        <span>
          <span className="block font-medium">
            {t("admin.doctor.superDoctor")}
          </span>
          <span className="block text-muted">
            {t("admin.doctor.superDoctorHint")}
          </span>
        </span>
      </label>
    </>
  );
  // A new doctor is entered in three steps; an existing one is edited on one page.
  if (!doctor) {
    return (
      <ActionForm action={action}>
        <StepFields
          steps={[
            { title: t("admin.doctor.stepIdentity"), content: identity },
            { title: t("admin.doctor.stepPricing"), content: pricing },
            { title: t("admin.doctor.stepSignatures"), content: signatures },
          ]}
          submit={submit}
        />
      </ActionForm>
    );
  }
  return (
    <ActionForm action={action} className="space-y-8">
      {identity}
      {pricing}
      {signatures}
      <Active t={t} defaultChecked={doctor.active && doctor.user.active} />
      {submit}
    </ActionForm>
  );
}

export function OperationForm({
  action,
  t,
  operation,
}: {
  action: Action;
  t: TFunction;
  operation?: Operation;
}) {
  return (
    <ActionForm action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label={t("admin.operation.slug")}
          hint={t("admin.operation.slugHint")}
        >
          <Input
            name="slug"
            defaultValue={operation?.slug}
            pattern="[a-z0-9\-]{2,60}"
            required
          />
        </Field>
        <Field label={t("admin.operation.basePrice")}>
          <Input
            name="basePrice"
            inputMode="decimal"
            defaultValue={operation ? centsToInput(operation.basePrice) : ""}
            required
          />
        </Field>
        <Field label={t("admin.operation.recovery")}>
          <Input
            type="number"
            name="defaultRecoveryNights"
            min={1}
            max={60}
            defaultValue={operation?.defaultRecoveryNights ?? 7}
            required
          />
        </Field>
      </div>
      {(["Fr", "En", "Ar"] as const).map((l) => (
        <div
          key={l}
          className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-[240px_1fr]"
        >
          <Field label={`${t("admin.operation.name")} (${l.toUpperCase()})`}>
            <Input
              name={`name${l}`}
              defaultValue={operation?.[`name${l}`]}
              dir={l === "Ar" ? "rtl" : undefined}
              required
            />
          </Field>
          <Field
            label={`${t("admin.operation.description")} (${l.toUpperCase()})`}
          >
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

export function StayForm({
  action,
  t,
  stay,
}: {
  action: Action;
  t: TFunction;
  stay?: Accommodation;
}) {
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
          <Input
            name="pricePerNight"
            inputMode="decimal"
            defaultValue={stay ? centsToInput(stay.pricePerNight) : ""}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("admin.stay.capacity")}>
            <Input
              type="number"
              name="capacity"
              min={1}
              max={30}
              defaultValue={stay?.capacity ?? 2}
              required
            />
          </Field>
          <Field label={t("admin.stay.bedrooms")}>
            <Input
              type="number"
              name="bedrooms"
              min={0}
              max={30}
              defaultValue={stay?.bedrooms ?? 1}
              required
            />
          </Field>
        </div>
        <Field
          label={t("admin.stay.amenities")}
          hint={t("admin.commaHint")}
          className="sm:col-span-2"
        >
          <Input
            name="amenities"
            defaultValue={stay?.amenities.join(", ")}
            placeholder="Wi-Fi, Climatisation, Ascenseur"
          />
        </Field>
        <Field
          label={t("admin.stay.photoUpload")}
          hint={t("admin.photoUploadHint")}
          className="sm:col-span-2"
        >
          <ImageInput name="photoFiles" multiple />
        </Field>
        <Field
          label={t("admin.stay.photos")}
          hint={t("admin.stay.photosHint")}
          className="sm:col-span-2"
        >
          <Textarea
            name="photos"
            rows={3}
            defaultValue={stay?.photos.join("\n")}
            placeholder="https://…"
          />
        </Field>
        <Field label={t("admin.stay.description")} className="sm:col-span-2">
          <Textarea
            name="description"
            rows={4}
            defaultValue={stay?.description}
            required
          />
        </Field>
      </div>
      <Active t={t} defaultChecked={stay?.active ?? true} />
      <SubmitButton>{t("common.save")}</SubmitButton>
    </ActionForm>
  );
}
