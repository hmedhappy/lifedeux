"use client";

import { createContext, useContext, useState } from "react";
import clsx from "clsx";
import { formatMoney } from "@/lib/format";
import { computeQuote } from "@/lib/pricing";
import type { ActionState } from "@/lib/action-state";
import { ActionForm, SubmitButton } from "./forms";
import { useI18n } from "./i18n-provider";
import { Photo } from "./photo";
import { Button, Input } from "./ui";

export type StayOption = {
  id: string;
  title: string;
  type: string;
  city: string;
  capacity: number;
  bedrooms: number;
  pricePerNight: number;
  amenities: string[];
  photo: string | null;
  available: boolean;
};

type Companion = { firstName: string; lastName: string; passportNumber: string | null };

export type OptionsConfig = {
  stays: StayOption[];
  currency: string;
  nights: number;
  operationPrice: number;
  transportPricePerPerson: number;
  maxCompanions: number;
  initial: { withTransport: boolean; accommodationId: string | null; companions: Companion[] };
};

type OptionsState = ReturnType<typeof useOptionsState>;

function useOptionsState(config: OptionsConfig) {
  const [transport, setTransport] = useState(config.initial.withTransport);
  const [stayId, setStayId] = useState<string | null>(config.initial.accommodationId);
  const [count, setCount] = useState(config.initial.companions.length);
  const selected = config.stays.find((s) => s.id === stayId) ?? null;
  const quote = computeQuote({
    operationPrice: config.operationPrice,
    withTransport: transport,
    companionsCount: count,
    transportPricePerPerson: config.transportPricePerPerson,
    accommodation: selected,
    nights: config.nights,
  });
  return { ...config, transport, setTransport, stayId, setStayId, count, setCount, selected, quote, travellers: 1 + count };
}

const OptionsContext = createContext<OptionsState | null>(null);

/** Shares the options being chosen between the form and the live summary in the sidebar. */
export function OptionsProvider({ config, children }: { config: OptionsConfig; children: React.ReactNode }) {
  const state = useOptionsState(config);
  return <OptionsContext.Provider value={state}>{children}</OptionsContext.Provider>;
}

function useOptions(): OptionsState {
  const ctx = useContext(OptionsContext);
  if (!ctx) throw new Error("OptionsForm must be rendered inside OptionsProvider");
  return ctx;
}

export const OPTIONS_FORM_ID = "options-form";

/** Sidebar receipt that follows every change made in the options form. */
export function LiveOptionsSummary() {
  const { t, locale } = useI18n();
  const { quote, travellers, selected, nights, currency } = useOptions();
  const money = (v: number) => formatMoney(v, currency, locale);
  const row = (label: string, value: string, testId?: string) => (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-medium text-ink" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
  return (
    <>
      <dl className="space-y-3 border-t border-line pt-5 text-sm" aria-live="polite">
        {row(t("booking.travellers"), String(travellers), "live-travellers")}
        {row(t("booking.transfer"), quote.withTransport ? t("common.yes") : t("common.no"))}
        {row(t("booking.stay"), selected?.title ?? t("common.no"), "live-stay")}
      </dl>
      <dl className="space-y-2 border-t border-line pt-5 text-sm" aria-live="polite">
        {row(t("price.operation"), money(quote.operationPrice))}
        {row(t("price.transport", { n: travellers }), money(quote.transportPrice))}
        {row(t("price.stay", { n: nights }), money(quote.accommodationPrice))}
        <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-semibold text-ink">
          <dt>{t("price.total")}</dt>
          <dd data-testid="booking-total">{money(quote.totalAmount)}</dd>
        </div>
      </dl>
      <Button type="submit" form={OPTIONS_FORM_ID} size="lg" className="w-full">
        {t("options.continue")}
      </Button>
    </>
  );
}

export function OptionsForm({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const { t, locale } = useI18n();
  const {
    stays, currency, nights, transportPricePerPerson, maxCompanions, initial,
    setTransport, stayId, setStayId, count, setCount, selected, quote, travellers,
  } = useOptions();
  const money = (v: number) => formatMoney(v, currency, locale);

  return (
    <ActionForm action={action} className="space-y-10" id={OPTIONS_FORM_ID}>
      <section>
        <h3 className="text-lg font-semibold text-ink">{t("options.companionsTitle")}</h3>
        <p className="mt-1 text-sm text-muted">{t("options.companionsText", { n: maxCompanions })}</p>
        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            aria-label={t("options.less")}
            onClick={() => setCount((c) => Math.max(0, c - 1))}
            disabled={count === 0}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-8 text-center text-lg font-semibold" data-testid="companions-count">
            {count}
          </span>
          <button
            type="button"
            aria-label={t("options.more")}
            onClick={() => setCount((c) => Math.min(maxCompanions, c + 1))}
            disabled={count >= maxCompanions}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg disabled:opacity-40"
          >
            +
          </button>
          <input type="hidden" name="companionsCount" value={count} />
        </div>
        {Array.from({ length: count }, (_, i) => (
          <fieldset key={i} className="mt-4 grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-3">
            <legend className="px-1 text-sm font-medium text-ink">{t("options.companion", { n: i + 1 })}</legend>
            <Input
              name={`companion_${i}_firstName`}
              placeholder={t("fields.firstName")}
              aria-label={t("fields.firstName")}
              defaultValue={initial.companions[i]?.firstName}
              required
            />
            <Input
              name={`companion_${i}_lastName`}
              placeholder={t("fields.lastName")}
              aria-label={t("fields.lastName")}
              defaultValue={initial.companions[i]?.lastName}
              required
            />
            <Input
              name={`companion_${i}_passport`}
              placeholder={t("fields.passport")}
              aria-label={t("fields.passport")}
              defaultValue={initial.companions[i]?.passportNumber ?? ""}
              required
            />
          </fieldset>
        ))}
      </section>

      <section>
        <h3 className="text-lg font-semibold text-ink">{t("options.stayTitle")}</h3>
        <p className="mt-1 text-sm text-muted">{t("options.stayText", { n: nights })}</p>
        <input type="hidden" name="accommodationId" value={stayId ?? ""} />
        <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <button
            type="button"
            onClick={() => setStayId(null)}
            aria-pressed={stayId === null}
            className={clsx(
              "flex min-h-40 flex-col justify-center rounded-2xl border-2 p-5 text-start transition",
              stayId === null ? "border-ink" : "border-line hover:border-muted",
            )}
          >
            <span className="font-semibold text-ink">{t("options.noStay")}</span>
            <span className="mt-1 text-sm text-muted">{t("options.noStayText")}</span>
          </button>
          {stays.map((s) => {
            const disabled = !s.available || s.capacity < travellers;
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => setStayId(s.id)}
                aria-pressed={stayId === s.id}
                data-testid="stay-option"
                className={clsx(
                  "overflow-hidden rounded-2xl border-2 text-start transition",
                  stayId === s.id ? "border-ink" : "border-line hover:border-muted",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <Photo src={s.photo} alt={s.title} className="aspect-[4/3] w-full" />
                <div className="p-4">
                  <p className="font-semibold text-ink">{s.title}</p>
                  <p className="text-sm text-muted">
                    {t(`accType.${s.type}`)} · {s.city} · {t("stays.guests", { n: s.capacity })}
                  </p>
                  {s.amenities.length > 0 && <p className="mt-1 line-clamp-1 text-xs text-muted">{s.amenities.join(" · ")}</p>}
                  <p className="mt-2 text-sm">
                    <span className="font-semibold text-ink">{money(s.pricePerNight)}</span>{" "}
                    <span className="text-muted">{t("stays.perNight")}</span>
                  </p>
                  {!s.available ? (
                    <p className="mt-1 text-xs font-semibold text-red-700">{t("options.unavailable")}</p>
                  ) : s.capacity < travellers ? (
                    <p className="mt-1 text-xs font-semibold text-red-700">{t("options.tooSmall")}</p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-ink">{t("options.transferTitle")}</h3>
        <label
          className={clsx(
            "mt-4 flex items-start gap-4 rounded-2xl border-2 p-5",
            quote.withTransport ? "border-ink" : "border-line",
          )}
        >
          <input
            type="checkbox"
            name="transport"
            checked={quote.withTransport}
            disabled={selected !== null}
            onChange={(e) => setTransport(e.target.checked)}
            className="mt-1 h-5 w-5 accent-brand"
          />
          {selected !== null && <input type="hidden" name="transport" value="on" />}
          <span>
            <span className="block font-semibold text-ink">{t("options.transferLabel")}</span>
            <span className="block text-sm text-muted">
              {selected ? t("options.transferIncluded") : t("options.transferText", { price: money(transportPricePerPerson) })}
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-2xl bg-surface p-6">
        <h3 className="font-semibold text-ink">{t("options.summary")}</h3>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("price.operation")}</dt>
            <dd>{money(quote.operationPrice)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("price.transport", { n: travellers })}</dt>
            <dd>{money(quote.transportPrice)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("price.stay", { n: nights })}</dt>
            <dd>{money(quote.accommodationPrice)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-semibold text-ink">
            <dt>{t("price.total")}</dt>
            <dd data-testid="quote-total">{money(quote.totalAmount)}</dd>
          </div>
        </dl>
        <SubmitButton size="lg" className="mt-6 w-full">
          {t("options.continue")}
        </SubmitButton>
      </section>
    </ActionForm>
  );
}
