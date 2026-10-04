"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { Building2, MonitorSmartphone, Stethoscope } from "lucide-react";
import { ActionForm, SubmitButton } from "./forms";
import { StepFields } from "./step-fields";
import { useI18n } from "./i18n-provider";
import { Field, Input, Notice, Select } from "./ui";
import type { ActionState } from "@/lib/action-state";

// Leaflet touches `window`: the map only renders in the browser.
const ClinicMap = dynamic(() => import("./clinic-map").then((m) => m.ClinicMap), {
  ssr: false,
  loading: () => <div className="ld-skeleton h-72 rounded-2xl" />,
});

type Mode = "clinic" | "online" | "both";

export function DoctorOnboarding({
  action,
  email,
  specialties,
  currency,
  onlineShare,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  email: string;
  specialties: { id: string; name: string }[];
  currency: string;
  /** Share of the online price paid to the doctor, in percent. */
  onlineShare: number;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("both");
  const atClinic = mode !== "online";
  const online = mode !== "clinic";

  const modes: { value: Mode; icon: typeof Building2; label: string; hint: string }[] = [
    { value: "clinic", icon: Building2, label: t("onboard.modeClinic"), hint: t("onboard.modeClinicHint") },
    { value: "online", icon: MonitorSmartphone, label: t("onboard.modeOnline"), hint: t("onboard.modeOnlineHint") },
    { value: "both", icon: Stethoscope, label: t("onboard.modeBoth"), hint: t("onboard.modeBothHint") },
  ];

  return (
    <ActionForm action={action}>
      <input type="hidden" name="mode" value={mode} />
      <StepFields
        steps={[
          {
            title: t("onboard.step1"),
            content: (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("fields.firstName")} hint={t("fields.latinHint")}>
                    <div className="flex items-center">
                      <span className="flex items-center self-stretch rounded-s-xl border border-e-0 border-line-strong bg-surface px-3 text-sm font-semibold text-ink-soft">
                        Dr
                      </span>
                      <Input name="firstName" autoComplete="given-name" required className="rounded-s-none" />
                    </div>
                  </Field>
                  <Field label={t("fields.lastName")}>
                    <Input name="lastName" autoComplete="family-name" required />
                  </Field>
                </div>
                <Field label={t("fields.email")} hint={t("onboard.emailLocked")}>
                  <Input type="email" value={email} readOnly className="bg-surface text-ink-soft" data-testid="onboard-email" />
                </Field>
                <Field label={t("onboard.phoneOptional")}>
                  <Input type="tel" name="phone" autoComplete="tel" inputMode="tel" />
                </Field>
              </>
            ),
          },
          {
            title: t("onboard.step2"),
            content: (
              <>
                <Field label={t("onboard.specialty")}>
                  <Select name="specialtyId" defaultValue="" required>
                    <option value="" disabled>
                      {t("onboard.specialtyPick")}
                    </option>
                    {specialties.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div role="radiogroup" aria-label={t("onboard.where")}>
                  <p className="mb-1.5 text-sm font-medium text-ink">{t("onboard.where")}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {modes.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        role="radio"
                        aria-checked={mode === m.value}
                        onClick={() => setMode(m.value)}
                        data-testid={`mode-${m.value}`}
                        className={clsx(
                          "flex items-center gap-3 rounded-2xl border p-3 text-start transition sm:flex-col sm:items-start sm:gap-2",
                          mode === m.value ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-line bg-white hover:bg-surface",
                        )}
                      >
                        <m.icon className={clsx("h-5 w-5 shrink-0", mode === m.value ? "text-brand" : "text-muted")} aria-hidden />
                        <span>
                          <span className="block text-sm font-semibold text-ink">{m.label}</span>
                          <span className="block text-xs text-muted">{m.hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                {atClinic && (
                  <>
                    <Field label={t("onboard.clinicName")}>
                      <Input name="clinicName" autoComplete="organization" />
                    </Field>
                    <ClinicMap />
                  </>
                )}
              </>
            ),
          },
          {
            title: t("onboard.step3"),
            content: (
              <>
                {online && (
                  <PriceField
                    name="onlinePrice"
                    label={t("onboard.priceOnline")}
                    hint={t("onboard.priceOnlineHint", { share: String(onlineShare) })}
                    currency={currency}
                  />
                )}
                {atClinic && (
                  <PriceField name="clinicPrice" label={t("onboard.priceClinic")} hint={t("onboard.priceClinicHint")} currency={currency} />
                )}
                {online && <Notice tone="info">{t("onboard.stampNote")}</Notice>}
                <label className="flex items-start gap-3 text-sm text-ink">
                  <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 accent-brand" />
                  <span>{t("referral.consent")}</span>
                </label>
              </>
            ),
          },
        ]}
        submit={
          <SubmitButton size="lg" className="w-full" testId="onboard-submit">
            {t("onboard.submit")}
          </SubmitButton>
        }
      />
    </ActionForm>
  );
}

function PriceField({ name, label, hint, currency }: { name: string; label: string; hint: string; currency: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center">
        <Input name={name} inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" required className="rounded-e-none" placeholder="40" />
        <span className="flex items-center self-stretch rounded-e-xl border border-s-0 border-line-strong bg-surface px-3 text-sm font-semibold text-ink-soft">
          {currency}
        </span>
      </div>
    </Field>
  );
}
