"use client";

import { useState } from "react";
import { useI18n } from "./i18n-provider";
import { Field, Input } from "./ui";

const LAYOUTS = [
  { id: "teal", color: "#0f8f7e" },
  { id: "rose", color: "#e31c5f" },
  { id: "letterhead", color: "#1e3a5f" },
] as const;

const fileClass =
  "block w-full text-sm text-muted file:me-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-surface";

/** Fields of a new prescription template; the letterhead options only show for that layout. */
export function TemplateForm() {
  const { t } = useI18n();
  const [layout, setLayout] = useState<(typeof LAYOUTS)[number]["id"]>("teal");
  const [color, setColor] = useState<string>(LAYOUTS[0].color);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label={t("rxTemplates.name")}>
          <Input name="name" maxLength={60} required placeholder={t("rxTemplates.namePlaceholder")} />
        </Field>
        <Field label={t("rxTemplates.color")}>
          <input
            type="color"
            name="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-11 w-full cursor-pointer rounded-xl border border-line bg-white p-1"
          />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t("rxTemplates.base")}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {LAYOUTS.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-line p-4 text-sm has-[:checked]:border-ink">
              <input
                type="radio"
                name="layout"
                value={l.id}
                checked={layout === l.id}
                onChange={() => {
                  setLayout(l.id);
                  setColor(l.color);
                }}
                className="mt-0.5 accent-brand"
              />
              <span>
                <span className="block font-semibold text-ink">{t(`rxTemplates.layout.${l.id}`)}</span>
                <span className="block text-muted">{t(`rxTemplates.layoutHint.${l.id}`)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {layout === "letterhead" && (
        <div className="space-y-4 rounded-xl bg-surface p-4">
          <Field label={t("rxTemplates.background")} hint={t("rxTemplates.backgroundHint")}>
            <input type="file" name="background" accept="image/png,image/jpeg" required className={fileClass} data-testid="letterhead-file" />
          </Field>
          <div>
            <p className="text-sm font-medium text-ink">{t("rxTemplates.margins")}</p>
            <p className="text-xs text-muted">{t("rxTemplates.marginsHint")}</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["marginTop", 45],
                  ["marginBottom", 30],
                  ["marginLeft", 18],
                  ["marginRight", 18],
                ] as const
              ).map(([name, value]) => (
                <Field key={name} label={t(`rxTemplates.${name}`)}>
                  <Input type="number" name={name} min={0} max={120} defaultValue={value} />
                </Field>
              ))}
            </div>
          </div>
        </div>
      )}
      {layout !== "letterhead" &&
        (["marginTop", "marginBottom", "marginLeft", "marginRight"] as const).map((name) => (
          <input key={name} type="hidden" name={name} value={name === "marginTop" ? 45 : name === "marginBottom" ? 30 : 18} />
        ))}
      <label className="flex items-center gap-3 text-sm text-ink">
        <input type="checkbox" name="makeDefault" defaultChecked className="h-4 w-4 accent-brand" />
        {t("rxTemplates.makeDefault")}
      </label>
    </>
  );
}
