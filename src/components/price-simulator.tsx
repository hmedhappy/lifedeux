"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { computeQuote } from "@/lib/pricing";
import { useI18n } from "./i18n-provider";
import { Select } from "./ui";

type Surgeon = { id: string; name: string; price: number };
type Stay = { id: string; title: string; pricePerNight: number; capacity: number };

/**
 * Total trip estimate before any request: surgeon, travellers, lodging and transfer.
 * Same arithmetic as the real quote (computeQuote); the final price follows the
 * surgeon's confirmed recovery nights.
 */
export function PriceSimulator({
  surgeons,
  stays,
  nights,
  transportPricePerPerson,
  maxCompanions,
  currency,
}: {
  surgeons: Surgeon[];
  stays: Stay[];
  nights: number;
  transportPricePerPerson: number;
  maxCompanions: number;
  currency: string;
}) {
  const { t, locale } = useI18n();
  const [surgeonId, setSurgeonId] = useState(surgeons[0]?.id ?? "");
  const [companions, setCompanions] = useState(0);
  const [stayId, setStayId] = useState<string>(stays[0]?.id ?? "");
  const [transfer, setTransfer] = useState(true);
  const surgeon = surgeons.find((s) => s.id === surgeonId) ?? surgeons[0];
  // A lodging too small for the group is hidden from the list, so it must not count either.
  const stay = stays.find((s) => s.id === stayId && s.capacity >= 1 + companions) ?? null;
  const quote = computeQuote({
    operationPrice: surgeon?.price ?? 0,
    withTransport: transfer,
    companionsCount: companions,
    transportPricePerPerson,
    accommodation: stay,
    nights,
  });
  const money = (v: number) => formatMoney(v, currency, locale);

  return (
    <div className="space-y-4" data-testid="price-simulator">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">{t("surgery.surgeon")}</span>
        <Select value={surgeonId} onChange={(e) => setSurgeonId(e.target.value)}>
          {surgeons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {money(s.price)}
            </option>
          ))}
        </Select>
      </label>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-ink">{t("surgery.travellers")}</span>
        <span className="flex items-center gap-3">
          <button type="button" onClick={() => setCompanions((c) => Math.max(0, c - 1))} disabled={companions === 0} aria-label={t("options.less")} className="flex h-10 w-10 items-center justify-center rounded-full border border-line disabled:opacity-40">
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <span className="min-w-6 text-center text-base font-semibold" data-testid="sim-travellers">
            {1 + companions}
          </span>
          <button type="button" onClick={() => setCompanions((c) => Math.min(maxCompanions, c + 1))} disabled={companions >= maxCompanions} aria-label={t("options.more")} className="flex h-10 w-10 items-center justify-center rounded-full border border-line disabled:opacity-40">
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </span>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">{t("surgery.lodging", { n: nights })}</span>
        <Select value={stay?.id ?? ""} onChange={(e) => setStayId(e.target.value)} data-testid="sim-stay">
          <option value="">{t("options.noStay")}</option>
          {stays
            .filter((s) => s.capacity >= 1 + companions)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} · {money(s.pricePerNight)} {t("stays.perNight")}
              </option>
            ))}
        </Select>
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={quote.withTransport} disabled={!!stay} onChange={(e) => setTransfer(e.target.checked)} className="h-4 w-4 accent-brand" />
        <span className="text-ink">{stay ? t("options.transferIncluded") : t("options.transferText", { price: money(transportPricePerPerson) })}</span>
      </label>
      <dl className="space-y-1.5 border-t border-line pt-4 text-sm">
        <Row label={t("price.operation")} value={money(quote.operationPrice)} />
        <Row label={t("price.transport", { n: 1 + companions })} value={money(quote.transportPrice)} />
        <Row label={t("price.stay", { n: nights })} value={money(quote.accommodationPrice)} />
        <div className="flex justify-between gap-4 border-t border-line pt-3 text-lg font-bold text-ink">
          <dt>{t("surgery.estimate")}</dt>
          <dd data-testid="sim-total">{money(quote.totalAmount)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted">{t("surgery.estimateHint")}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
