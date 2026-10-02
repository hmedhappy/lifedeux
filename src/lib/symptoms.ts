import { normalizeSearch } from "./search-text";

/**
 * Everyday words people type when they don't know the specialty's name.
 * Each entry maps FR / EN / AR words (accent-free, lowercase) to specialty slugs.
 */
export const SYMPTOMS: { words: string[]; slugs: string[] }[] = [
  { words: ["fievre", "grippe", "rhume", "toux", "fatigue", "angine", "fever", "flu", "cold", "cough", "حمى", "زكام", "سعال"], slugs: ["general-medicine"] },
  { words: ["coeur", "palpitation", "tension", "hypertension", "douleur thoracique", "heart", "chest pain", "blood pressure", "قلب", "ضغط"], slugs: ["cardiology"] },
  { words: ["stress", "anxiete", "angoisse", "depression", "deprime", "sommeil", "insomnie", "burn out", "anxiety", "sleep", "قلق", "اكتئاب", "نوم"], slugs: ["psychology", "psychiatry"] },
  { words: ["enfant", "bebe", "nourrisson", "vaccin", "child", "baby", "vaccine", "طفل", "رضيع", "تلقيح"], slugs: ["pediatrics"] },
  { words: ["peau", "acne", "bouton", "eczema", "grain de beaute", "tache", "cheveux", "chute de cheveux", "skin", "rash", "mole", "hair loss", "جلد", "حب الشباب", "شعر"], slugs: ["dermatology"] },
  { words: ["regles", "grossesse", "enceinte", "contraception", "menopause", "pregnancy", "period", "حمل", "دورة"], slugs: ["gynecology"] },
  { words: ["fertilite", "infertilite", "fiv", "bebe eprouvette", "ivf", "fertility", "عقم", "إنجاب"], slugs: ["fertility", "gynecology"] },
  { words: ["urine", "prostate", "vessie", "erection", "impuissance", "bladder", "erectile", "بول", "بروستاتا", "انتصاب"], slugs: ["urology", "andrology"] },
  { words: ["mal de tete", "migraine", "vertige", "epilepsie", "memoire", "headache", "dizziness", "صداع", "دوار"], slugs: ["neurology"] },
  { words: ["oeil", "yeux", "vue", "lunettes", "cataracte", "eye", "vision", "glasses", "عين", "نظر"], slugs: ["ophthalmology"] },
  { words: ["oreille", "gorge", "nez", "sinusite", "audition", "ear", "throat", "nose", "sinus", "أذن", "حلق", "أنف"], slugs: ["ent"] },
  { words: ["dent", "carie", "gencive", "implant", "blanchiment", "tooth", "teeth", "gum", "سن", "أسنان", "لثة"], slugs: ["dentistry", "orthodontics"] },
  { words: ["dos", "genou", "epaule", "fracture", "entorse", "articulation", "hanche", "back", "knee", "shoulder", "joint", "hip", "ظهر", "ركبة", "كتف", "مفصل"], slugs: ["orthopedics", "rheumatology", "physiotherapy"] },
  { words: ["ventre", "estomac", "digestion", "reflux", "constipation", "diarrhee", "stomach", "belly", "bloating", "بطن", "معدة", "هضم"], slugs: ["gastroenterology"] },
  { words: ["foie", "hepatite", "liver", "كبد"], slugs: ["hepatology"] },
  { words: ["diabete", "glycemie", "sucre", "thyroide", "hormone", "diabetes", "thyroid", "سكري", "غدة"], slugs: ["diabetology", "endocrinology"] },
  { words: ["rein", "calcul renal", "kidney", "كلى"], slugs: ["nephrology"] },
  { words: ["asthme", "respiration", "essoufflement", "poumon", "asthma", "breathing", "lung", "ربو", "تنفس", "رئة"], slugs: ["pulmonology", "allergology"] },
  { words: ["allergie", "allergy", "حساسية"], slugs: ["allergology"] },
  { words: ["poids", "regime", "obesite", "maigrir", "weight", "diet", "obesity", "وزن", "حمية", "سمنة"], slugs: ["nutrition", "bariatric-surgery"] },
  { words: ["cancer", "tumeur", "tumor", "سرطان", "ورم"], slugs: ["oncology"] },
  { words: ["sang", "anemie", "blood", "anemia", "دم", "فقر الدم"], slugs: ["hematology"] },
  { words: ["chirurgie esthetique", "rhinoplastie", "liposuccion", "botox", "cosmetic", "plastic", "تجميل"], slugs: ["plastic-surgery"] },
  { words: ["parole", "begaiement", "speech", "stutter", "نطق"], slugs: ["speech-therapy"] },
  { words: ["sport", "blessure", "injury", "رياضة", "إصابة"], slugs: ["sports-medicine"] },
];

/** Specialty slugs suggested by a free-text search ("mal au dos" → orthopedics…). */
export function specialtiesForSymptom(query: string): string[] {
  const q = normalizeSearch(query);
  if (q.length < 3) return [];
  const slugs = new Set<string>();
  for (const s of SYMPTOMS) {
    if (s.words.some((w) => q.includes(normalizeSearch(w)) || (q.length >= 4 && normalizeSearch(w).startsWith(q)))) {
      s.slugs.forEach((slug) => slugs.add(slug));
    }
  }
  return [...slugs];
}
