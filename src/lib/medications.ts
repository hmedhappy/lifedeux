import "server-only";
import { db } from "./db";
import { normalizeSearch } from "./search-text";

export type MedicationHit = { id: string; name: string; dci: string | null; form: string | null; strength: string | null };

/**
 * Medication search used by the prescription editor.
 *
 * Today it runs on PostgreSQL over a normalized `searchText` column. To move to
 * Elasticsearch, keep this signature and query your index here (for example a
 * multi_match on name/dci with fuzziness, boosted by specialtyId); nothing else
 * in the app needs to change.
 */
export async function searchMedications(query: string, options: { specialtyId?: string | null; limit?: number } = {}): Promise<MedicationHit[]> {
  const terms = normalizeSearch(query).split(" ").filter((t) => t.length > 0).slice(0, 5);
  if (terms.length === 0) return [];
  const limit = options.limit ?? 12;
  const rows = await db.medication.findMany({
    where: { AND: terms.map((term) => ({ searchText: { contains: term } })) },
    select: { id: true, name: true, dci: true, form: true, strength: true, specialtyId: true, searchText: true },
    take: 60,
  });
  const first = terms[0];
  const score = (r: (typeof rows)[number]) =>
    (r.searchText.startsWith(first) ? 2 : 0) + (options.specialtyId && r.specialtyId === options.specialtyId ? 1 : 0);
  return rows
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ id, name, dci, form, strength }) => ({ id, name, dci, form, strength }));
}
