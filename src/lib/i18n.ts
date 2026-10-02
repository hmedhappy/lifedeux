import fr from "@/messages/fr.json";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

export const locales = ["fr", "en", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export type Messages = typeof fr;

const dictionaries: Record<Locale, Messages> = { fr, en, ar };

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function toLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : defaultLocale;
}

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

function lookup(messages: unknown, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Messages use `{name}` for values and `{n:singular|plural}` for a word that agrees
 * with a number, e.g. "{n} {n:médecin|médecins}". French treats 0 as singular.
 */
export function createT(messages: Messages, locale?: Locale): TFunction {
  return (key, vars) => {
    const template = lookup(messages, key) ?? lookup(fr, key) ?? key;
    if (!vars) return template;
    return template
      .replace(/\{(\w+):([^}|]*)\|([^}]*)\}/g, (_, name: string, one: string, other: string) => {
        const n = Number(vars[name]);
        const singular = Math.abs(n) === 1 || (locale === "fr" && n === 0);
        return singular ? one : other;
      })
      .replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
  };
}

export function getT(locale: Locale): TFunction {
  return createT(getMessages(locale), locale);
}

/** Picks the localized field of a record having `<base>Fr`, `<base>En`, `<base>Ar` columns. */
export function localized<T extends Record<string, unknown>>(
  record: T,
  base: string,
  locale: Locale,
): string {
  const suffix = locale.charAt(0).toUpperCase() + locale.slice(1);
  const value = record[`${base}${suffix}`] ?? record[`${base}Fr`];
  return typeof value === "string" ? value : "";
}
