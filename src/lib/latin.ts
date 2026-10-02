/**
 * Names (patients, doctors, companions) and free-text medicine lines are written in
 * Latin letters, accents included: prescriptions are printed with Latin-only fonts.
 * Arabic text is refused in these fields with a clear message (docs/RELOOKING.md, §3).
 */
const LETTER = /\p{L}/u;
const LATIN = /\p{Script=Latin}/u;

/** Every letter is a Latin letter (digits, spaces and punctuation are allowed). */
export function isLatinText(value: string): boolean {
  return [...value].every((c) => !LETTER.test(c) || LATIN.test(c));
}

/** A person's name: at least one Latin letter, then letters, spaces, apostrophes, dots or hyphens. */
export function isLatinName(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && /^[\p{Script=Latin}][\p{Script=Latin}\s'’.\-]*$/u.test(v);
}
