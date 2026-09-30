/** One flat tint per family of specialties (icon colour + soft background). */
const FAMILIES: [string, string[]][] = [
  ["bg-teal-50 text-teal-700", ["general-medicine", "internal-medicine", "geriatrics", "emergency-medicine", "infectious-diseases"]],
  ["bg-rose-50 text-rose-700", ["cardiology", "cardiac-surgery", "vascular-surgery", "hematology"]],
  ["bg-violet-50 text-violet-700", ["psychology", "psychiatry", "neurology", "neurosurgery", "speech-therapy"]],
  ["bg-amber-50 text-amber-700", ["pediatrics", "nutrition", "diabetology", "endocrinology"]],
  ["bg-sky-50 text-sky-700", ["ophthalmology", "ent", "dentistry", "orthodontics", "allergology", "pulmonology"]],
  ["bg-pink-50 text-pink-700", ["gynecology", "fertility", "andrology", "urology", "nephrology"]],
  ["bg-emerald-50 text-emerald-700", ["dermatology", "plastic-surgery", "rehabilitation", "physiotherapy", "sports-medicine", "orthopedics", "rheumatology"]],
];
const FALLBACK = "bg-indigo-50 text-indigo-700";

export function specialtyTint(slug: string | null | undefined): string {
  if (!slug) return FALLBACK;
  return FAMILIES.find(([, slugs]) => slugs.includes(slug))?.[0] ?? FALLBACK;
}
