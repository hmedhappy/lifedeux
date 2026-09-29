/** Lower-case and strip accents so "ibuprofene" finds "Ibuprofène". */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function medicationSearchText(m: { name: string; dci?: string | null; form?: string | null; strength?: string | null }): string {
  return normalizeSearch([m.name, m.dci, m.form, m.strength].filter(Boolean).join(" "));
}
