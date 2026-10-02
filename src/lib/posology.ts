/**
 * One-tap posology chips. Prescriptions are printed in French (Latin letters only),
 * so the chips are French whatever the interface language.
 */
export const POSOLOGY = {
  dosage: ["1 cp", "2 cp", "1 gélule", "1 sachet", "5 ml", "10 gouttes", "1 application"],
  frequency: ["1 fois/jour", "2 fois/jour", "3 fois/jour", "matin et soir", "le soir", "si douleur"],
  duration: ["3 jours", "5 jours", "7 jours", "10 jours", "15 jours", "1 mois", "3 mois"],
} as const;

export type PosologyField = keyof typeof POSOLOGY;
