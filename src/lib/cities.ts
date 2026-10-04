/** Approximate centres of Tunisian cities: a fallback position for practices not placed on the map. */
const CITIES: Record<string, { lat: number; lng: number }> = {
  tunis: { lat: 36.8065, lng: 10.1815 },
  ariana: { lat: 36.8625, lng: 10.1956 },
  "la marsa": { lat: 36.8782, lng: 10.3247 },
  "ben arous": { lat: 36.7531, lng: 10.2189 },
  manouba: { lat: 36.8101, lng: 10.0956 },
  bizerte: { lat: 37.2744, lng: 9.8739 },
  nabeul: { lat: 36.4561, lng: 10.7376 },
  hammamet: { lat: 36.4, lng: 10.6167 },
  sousse: { lat: 35.8256, lng: 10.6084 },
  monastir: { lat: 35.7643, lng: 10.8113 },
  mahdia: { lat: 35.5047, lng: 11.0622 },
  kairouan: { lat: 35.6781, lng: 10.0963 },
  sfax: { lat: 34.7406, lng: 10.7603 },
  gabes: { lat: 33.8815, lng: 10.0982 },
  djerba: { lat: 33.8076, lng: 10.8451 },
  medenine: { lat: 33.3549, lng: 10.5055 },
  gafsa: { lat: 34.425, lng: 8.7842 },
  beja: { lat: 36.7256, lng: 9.1817 },
  jendouba: { lat: 36.5011, lng: 8.7802 },
  kef: { lat: 36.1742, lng: 8.7049 },
  tozeur: { lat: 33.9197, lng: 8.1335 },
};

/** Matches "Tunis", "Gouvernorat Ariana", "Gabès"… (accents and prefixes ignored). */
export function cityCentre(city: string): { lat: number; lng: number } | null {
  const key = city
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^(gouvernorat( de| d')?|governorate( of)?)\s+/, "")
    .replace(/^le\s+/, "")
    .trim();
  return CITIES[key] ?? null;
}
