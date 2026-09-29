/**
 * Reference data shared by the seed scripts: medical specialties, procedures
 * and a small set of example medications. The medication list is only for
 * demos and tests; import the real database later (see src/lib/medications.ts).
 * Prices are in cents.
 */

export type SpecialtySeed = {
  slug: string;
  fr: string;
  en: string;
  ar: string;
  icon: string;
  price: number;
};

export const SPECIALTIES: SpecialtySeed[] = [
  { slug: "general-medicine", fr: "Médecine générale", en: "General practice", ar: "الطب العام", icon: "Stethoscope", price: 3000 },
  { slug: "cardiology", fr: "Cardiologie", en: "Cardiology", ar: "أمراض القلب", icon: "HeartPulse", price: 6000 },
  { slug: "psychology", fr: "Psychologie", en: "Psychology", ar: "علم النفس", icon: "HeartHandshake", price: 5000 },
  { slug: "psychiatry", fr: "Psychiatrie", en: "Psychiatry", ar: "الطب النفسي", icon: "Brain", price: 6000 },
  { slug: "pediatrics", fr: "Pédiatrie", en: "Pediatrics", ar: "طب الأطفال", icon: "Baby", price: 4000 },
  { slug: "dermatology", fr: "Dermatologie", en: "Dermatology", ar: "الأمراض الجلدية", icon: "ScanFace", price: 5000 },
  { slug: "gynecology", fr: "Gynécologie-obstétrique", en: "Obstetrics & gynecology", ar: "أمراض النساء والتوليد", icon: "Venus", price: 5000 },
  { slug: "urology", fr: "Urologie", en: "Urology", ar: "المسالك البولية", icon: "Droplets", price: 5000 },
  { slug: "andrology", fr: "Andrologie et sexologie", en: "Andrology & sexology", ar: "طب الذكورة والجنس", icon: "Mars", price: 5000 },
  { slug: "neurology", fr: "Neurologie", en: "Neurology", ar: "طب الأعصاب", icon: "BrainCircuit", price: 6000 },
  { slug: "ophthalmology", fr: "Ophtalmologie", en: "Ophthalmology", ar: "طب العيون", icon: "Eye", price: 5000 },
  { slug: "ent", fr: "ORL", en: "Ear, nose & throat", ar: "الأنف والأذن والحنجرة", icon: "Ear", price: 5000 },
  { slug: "dentistry", fr: "Chirurgie dentaire", en: "Dentistry", ar: "طب الأسنان", icon: "Smile", price: 4000 },
  { slug: "orthodontics", fr: "Orthodontie", en: "Orthodontics", ar: "تقويم الأسنان", icon: "SmilePlus", price: 4000 },
  { slug: "orthopedics", fr: "Orthopédie et traumatologie", en: "Orthopedics & traumatology", ar: "جراحة العظام والمفاصل", icon: "Bone", price: 6000 },
  { slug: "rheumatology", fr: "Rhumatologie", en: "Rheumatology", ar: "أمراض الروماتيزم", icon: "Footprints", price: 5500 },
  { slug: "gastroenterology", fr: "Gastro-entérologie", en: "Gastroenterology", ar: "أمراض الجهاز الهضمي", icon: "Salad", price: 6000 },
  { slug: "hepatology", fr: "Hépatologie", en: "Hepatology", ar: "أمراض الكبد", icon: "FlaskConical", price: 6000 },
  { slug: "endocrinology", fr: "Endocrinologie", en: "Endocrinology", ar: "الغدد الصماء", icon: "Activity", price: 6000 },
  { slug: "diabetology", fr: "Diabétologie", en: "Diabetology", ar: "أمراض السكري", icon: "Syringe", price: 5000 },
  { slug: "nephrology", fr: "Néphrologie", en: "Nephrology", ar: "أمراض الكلى", icon: "Bean", price: 6000 },
  { slug: "pulmonology", fr: "Pneumologie", en: "Pulmonology", ar: "أمراض الرئة", icon: "Wind", price: 6000 },
  { slug: "allergology", fr: "Allergologie", en: "Allergology", ar: "الحساسية", icon: "Flower2", price: 5000 },
  { slug: "oncology", fr: "Oncologie", en: "Oncology", ar: "علم الأورام", icon: "Ribbon", price: 8000 },
  { slug: "hematology", fr: "Hématologie", en: "Hematology", ar: "أمراض الدم", icon: "Droplet", price: 7000 },
  { slug: "infectious-diseases", fr: "Maladies infectieuses", en: "Infectious diseases", ar: "الأمراض المعدية", icon: "Microscope", price: 6000 },
  { slug: "internal-medicine", fr: "Médecine interne", en: "Internal medicine", ar: "الطب الباطني", icon: "ClipboardPlus", price: 5500 },
  { slug: "geriatrics", fr: "Gériatrie", en: "Geriatrics", ar: "طب الشيخوخة", icon: "Armchair", price: 5000 },
  { slug: "rehabilitation", fr: "Médecine physique et réadaptation", en: "Physical medicine & rehabilitation", ar: "الطب الفيزيائي وإعادة التأهيل", icon: "Dumbbell", price: 5000 },
  { slug: "sports-medicine", fr: "Médecine du sport", en: "Sports medicine", ar: "الطب الرياضي", icon: "Bike", price: 5000 },
  { slug: "physiotherapy", fr: "Kinésithérapie", en: "Physiotherapy", ar: "العلاج الطبيعي", icon: "HandHelping", price: 3500 },
  { slug: "nutrition", fr: "Nutrition et diététique", en: "Nutrition & dietetics", ar: "التغذية والحمية", icon: "Apple", price: 4000 },
  { slug: "fertility", fr: "Médecine de la reproduction", en: "Fertility & reproductive medicine", ar: "طب الإنجاب والخصوبة", icon: "Egg", price: 7000 },
  { slug: "speech-therapy", fr: "Orthophonie", en: "Speech therapy", ar: "تقويم النطق", icon: "MessagesSquare", price: 3500 },
  { slug: "general-surgery", fr: "Chirurgie générale", en: "General surgery", ar: "الجراحة العامة", icon: "Scissors", price: 6000 },
  { slug: "plastic-surgery", fr: "Chirurgie plastique et esthétique", en: "Plastic & cosmetic surgery", ar: "الجراحة التجميلية", icon: "Sparkles", price: 6000 },
  { slug: "cardiac-surgery", fr: "Chirurgie cardiaque", en: "Cardiac surgery", ar: "جراحة القلب", icon: "Heart", price: 8000 },
  { slug: "neurosurgery", fr: "Neurochirurgie", en: "Neurosurgery", ar: "جراحة الأعصاب", icon: "Waypoints", price: 8000 },
  { slug: "vascular-surgery", fr: "Chirurgie vasculaire", en: "Vascular surgery", ar: "جراحة الأوعية الدموية", icon: "Workflow", price: 7000 },
  { slug: "bariatric-surgery", fr: "Chirurgie bariatrique", en: "Bariatric surgery", ar: "جراحة السمنة", icon: "Scale", price: 6000 },
  { slug: "anesthesiology", fr: "Anesthésie-réanimation", en: "Anesthesiology", ar: "التخدير والإنعاش", icon: "Hospital", price: 6000 },
  { slug: "radiology", fr: "Radiologie et imagerie", en: "Radiology & imaging", ar: "الأشعة والتصوير الطبي", icon: "ScanLine", price: 5000 },
  { slug: "emergency-medicine", fr: "Médecine d'urgence", en: "Emergency medicine", ar: "طب الطوارئ", icon: "Ambulance", price: 4000 },
];

export type OperationSeed = {
  slug: string;
  specialty: string;
  fr: string;
  en: string;
  ar: string;
  descFr: string;
  descEn: string;
  descAr: string;
  price: number;
  recovery: number;
};

export const OPERATIONS: OperationSeed[] = [
  {
    slug: "prothese-penienne",
    specialty: "urology",
    fr: "Prothèse pénienne",
    en: "Penile prosthesis",
    ar: "زرع البدلة القضيبية",
    descFr:
      "Pose d'un implant pénien pour traiter une dysfonction érectile lorsque les autres traitements n'ont pas fonctionné. Intervention sous anesthésie, courte hospitalisation puis convalescence encadrée.",
    descEn:
      "Placement of a penile implant to treat erectile dysfunction when other treatments have not worked. Performed under anaesthesia, with a short hospital stay followed by supervised recovery.",
    descAr:
      "زرع بدلة قضيبية لعلاج ضعف الانتصاب عندما لا تنجح العلاجات الأخرى. تُجرى تحت التخدير مع إقامة قصيرة في المصحّة ثم فترة نقاهة مؤطَّرة.",
    price: 590000,
    recovery: 7,
  },
  {
    slug: "cataracte",
    specialty: "ophthalmology",
    fr: "Chirurgie de la cataracte",
    en: "Cataract surgery",
    ar: "جراحة إعتام عدسة العين",
    descFr: "Remplacement du cristallin opacifié par un implant, en ambulatoire.",
    descEn: "Replacement of the clouded lens with an implant, as a day procedure.",
    descAr: "استبدال عدسة العين المعتمة بعدسة مزروعة، دون مبيت.",
    price: 120000,
    recovery: 3,
  },
  {
    slug: "implant-dentaire",
    specialty: "dentistry",
    fr: "Implant dentaire",
    en: "Dental implant",
    ar: "زراعة الأسنان",
    descFr: "Pose d'un implant en titane et d'une couronne céramique.",
    descEn: "Titanium implant with a ceramic crown.",
    descAr: "زرع دعامة من التيتانيوم مع تاج خزفي.",
    price: 90000,
    recovery: 4,
  },
  {
    slug: "rhinoplastie",
    specialty: "plastic-surgery",
    fr: "Rhinoplastie",
    en: "Rhinoplasty",
    ar: "تجميل الأنف",
    descFr: "Remodelage du nez sous anesthésie générale.",
    descEn: "Reshaping of the nose under general anaesthesia.",
    descAr: "إعادة تشكيل الأنف تحت التخدير العام.",
    price: 280000,
    recovery: 7,
  },
  {
    slug: "greffe-cheveux",
    specialty: "dermatology",
    fr: "Greffe de cheveux (FUE)",
    en: "Hair transplant (FUE)",
    ar: "زراعة الشعر (FUE)",
    descFr: "Prélèvement et réimplantation de greffons, sous anesthésie locale.",
    descEn: "Harvesting and reimplantation of grafts under local anaesthesia.",
    descAr: "اقتطاع البصيلات وإعادة زرعها تحت التخدير الموضعي.",
    price: 180000,
    recovery: 3,
  },
  {
    slug: "sleeve",
    specialty: "bariatric-surgery",
    fr: "Sleeve gastrectomie",
    en: "Sleeve gastrectomy",
    ar: "تكميم المعدة",
    descFr: "Réduction de l'estomac par cœlioscopie pour traiter l'obésité.",
    descEn: "Laparoscopic reduction of the stomach to treat obesity.",
    descAr: "تصغير حجم المعدة بالمنظار لعلاج السمنة.",
    price: 450000,
    recovery: 10,
  },
  {
    slug: "prothese-hanche",
    specialty: "orthopedics",
    fr: "Prothèse totale de hanche",
    en: "Total hip replacement",
    ar: "استبدال مفصل الورك",
    descFr: "Remplacement de l'articulation de la hanche, suivi de rééducation.",
    descEn: "Replacement of the hip joint, followed by rehabilitation.",
    descAr: "استبدال مفصل الورك يليه إعادة تأهيل.",
    price: 650000,
    recovery: 14,
  },
];

export type MedicationSeed = { name: string; dci: string; form: string; strength: string; specialty: string | null };

export const MEDICATIONS: MedicationSeed[] = [
  { name: "Doliprane", dci: "Paracétamol", form: "Comprimé", strength: "1 g", specialty: null },
  { name: "Doliprane", dci: "Paracétamol", form: "Sirop pédiatrique", strength: "2,4 %", specialty: "pediatrics" },
  { name: "Advil", dci: "Ibuprofène", form: "Comprimé", strength: "400 mg", specialty: null },
  { name: "Clamoxyl", dci: "Amoxicilline", form: "Gélule", strength: "500 mg", specialty: "general-medicine" },
  { name: "Augmentin", dci: "Amoxicilline + acide clavulanique", form: "Comprimé", strength: "1 g / 125 mg", specialty: "general-medicine" },
  { name: "Zithromax", dci: "Azithromycine", form: "Comprimé", strength: "250 mg", specialty: "infectious-diseases" },
  { name: "Ciflox", dci: "Ciprofloxacine", form: "Comprimé", strength: "500 mg", specialty: "infectious-diseases" },
  { name: "Flagyl", dci: "Métronidazole", form: "Comprimé", strength: "500 mg", specialty: "infectious-diseases" },
  { name: "Mopral", dci: "Oméprazole", form: "Gélule", strength: "20 mg", specialty: "gastroenterology" },
  { name: "Inexium", dci: "Ésoméprazole", form: "Comprimé", strength: "40 mg", specialty: "gastroenterology" },
  { name: "Spasfon", dci: "Phloroglucinol", form: "Comprimé", strength: "80 mg", specialty: "gastroenterology" },
  { name: "Duphalac", dci: "Lactulose", form: "Solution buvable", strength: "10 g / 15 ml", specialty: "gastroenterology" },
  { name: "Imodium", dci: "Lopéramide", form: "Gélule", strength: "2 mg", specialty: "gastroenterology" },
  { name: "Glucophage", dci: "Metformine", form: "Comprimé", strength: "850 mg", specialty: "diabetology" },
  { name: "Lantus", dci: "Insuline glargine", form: "Stylo injectable", strength: "100 UI/ml", specialty: "diabetology" },
  { name: "Levothyrox", dci: "Lévothyroxine", form: "Comprimé", strength: "50 µg", specialty: "endocrinology" },
  { name: "Uvedose", dci: "Cholécalciférol (vitamine D3)", form: "Ampoule buvable", strength: "100 000 UI", specialty: "endocrinology" },
  { name: "Amlor", dci: "Amlodipine", form: "Gélule", strength: "5 mg", specialty: "cardiology" },
  { name: "Cardensiel", dci: "Bisoprolol", form: "Comprimé", strength: "5 mg", specialty: "cardiology" },
  { name: "Tahor", dci: "Atorvastatine", form: "Comprimé", strength: "20 mg", specialty: "cardiology" },
  { name: "Triatec", dci: "Ramipril", form: "Gélule", strength: "5 mg", specialty: "cardiology" },
  { name: "Kardegic", dci: "Acide acétylsalicylique", form: "Sachet", strength: "75 mg", specialty: "cardiology" },
  { name: "Plavix", dci: "Clopidogrel", form: "Comprimé", strength: "75 mg", specialty: "cardiology" },
  { name: "Zoloft", dci: "Sertraline", form: "Gélule", strength: "50 mg", specialty: "psychiatry" },
  { name: "Seroplex", dci: "Escitalopram", form: "Comprimé", strength: "10 mg", specialty: "psychiatry" },
  { name: "Xanax", dci: "Alprazolam", form: "Comprimé", strength: "0,25 mg", specialty: "psychiatry" },
  { name: "Atarax", dci: "Hydroxyzine", form: "Comprimé", strength: "25 mg", specialty: "psychology" },
  { name: "Euphytose", dci: "Extraits de plantes", form: "Comprimé", strength: "—", specialty: "psychology" },
  { name: "Ventoline", dci: "Salbutamol", form: "Suspension pour inhalation", strength: "100 µg/dose", specialty: "pulmonology" },
  { name: "Pulmicort", dci: "Budésonide", form: "Suspension pour inhalation", strength: "0,5 mg/2 ml", specialty: "pulmonology" },
  { name: "Singulair", dci: "Montélukast", form: "Comprimé", strength: "10 mg", specialty: "allergology" },
  { name: "Zyrtec", dci: "Cétirizine", form: "Comprimé", strength: "10 mg", specialty: "allergology" },
  { name: "Aerius", dci: "Desloratadine", form: "Comprimé", strength: "5 mg", specialty: "allergology" },
  { name: "Omix", dci: "Tamsulosine", form: "Gélule", strength: "0,4 mg", specialty: "urology" },
  { name: "Cialis", dci: "Tadalafil", form: "Comprimé", strength: "5 mg", specialty: "andrology" },
  { name: "Viagra", dci: "Sildénafil", form: "Comprimé", strength: "50 mg", specialty: "andrology" },
  { name: "Chibro-Proscar", dci: "Finastéride", form: "Comprimé", strength: "5 mg", specialty: "urology" },
  { name: "Curacné", dci: "Isotrétinoïne", form: "Capsule", strength: "20 mg", specialty: "dermatology" },
  { name: "Doxy", dci: "Doxycycline", form: "Comprimé", strength: "100 mg", specialty: "dermatology" },
  { name: "Hydrocortisone Kerapharm", dci: "Hydrocortisone", form: "Crème", strength: "1 %", specialty: "dermatology" },
  { name: "Minoxidil Bailleul", dci: "Minoxidil", form: "Solution cutanée", strength: "5 %", specialty: "dermatology" },
  { name: "Tobrex", dci: "Tobramycine", form: "Collyre", strength: "0,3 %", specialty: "ophthalmology" },
  { name: "Artelac", dci: "Hypromellose (larmes artificielles)", form: "Collyre", strength: "0,32 %", specialty: "ophthalmology" },
  { name: "Speciafoldine", dci: "Acide folique", form: "Comprimé", strength: "5 mg", specialty: "gynecology" },
  { name: "Utrogestan", dci: "Progestérone", form: "Capsule", strength: "200 mg", specialty: "gynecology" },
  { name: "Clomid", dci: "Clomifène", form: "Comprimé", strength: "50 mg", specialty: "fertility" },
  { name: "Novatrex", dci: "Méthotrexate", form: "Comprimé", strength: "2,5 mg", specialty: "rheumatology" },
  { name: "Voltarène Emulgel", dci: "Diclofénac", form: "Gel", strength: "1 %", specialty: "rheumatology" },
  { name: "Colchicine Opocalcium", dci: "Colchicine", form: "Comprimé", strength: "1 mg", specialty: "rheumatology" },
  { name: "Zyloric", dci: "Allopurinol", form: "Comprimé", strength: "100 mg", specialty: "rheumatology" },
  { name: "Solupred", dci: "Prednisolone", form: "Comprimé orodispersible", strength: "20 mg", specialty: "internal-medicine" },
  { name: "Lovenox", dci: "Énoxaparine", form: "Seringue injectable", strength: "4 000 UI", specialty: "general-surgery" },
  { name: "Contramal", dci: "Tramadol", form: "Gélule", strength: "50 mg", specialty: "orthopedics" },
  { name: "Zophren", dci: "Ondansétron", form: "Comprimé", strength: "8 mg", specialty: "oncology" },
  { name: "Eludril", dci: "Chlorhexidine", form: "Bain de bouche", strength: "0,1 %", specialty: "dentistry" },
  { name: "Tardyferon", dci: "Sulfate ferreux", form: "Comprimé", strength: "80 mg", specialty: "hematology" },
  { name: "Physiomer", dci: "Eau de mer isotonique", form: "Spray nasal", strength: "—", specialty: "ent" },
  { name: "Otipax", dci: "Phénazone + lidocaïne", form: "Gouttes auriculaires", strength: "4 % / 1 %", specialty: "ent" },
];

export { medicationSearchText, normalizeSearch } from "../../src/lib/search-text";
