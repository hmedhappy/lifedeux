/**
 * Seeds the platform settings, the first admin account and the base operation.
 * With SEED_DEMO=true it also creates clearly-marked demo doctors, stays,
 * slots, an agent and a patient so the whole flow can be tried locally.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;

async function upsertUser(data: {
  email: string;
  password: string;
  role: "ADMIN" | "DOCTOR" | "AGENT" | "PATIENT";
  firstName: string;
  lastName: string;
  phone?: string;
  country?: string;
  locale?: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const { password: _password, ...rest } = data;
  void _password;
  return db.user.upsert({
    where: { email: data.email },
    update: {},
    create: { ...rest, passwordHash, consentAt: new Date() },
  });
}

async function main() {
  await db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1, transportPricePerPerson: 8000 } });

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 8) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) before seeding.");
  }
  await upsertUser({ email: adminEmail.toLowerCase(), password: adminPassword, role: "ADMIN", firstName: "Admin", lastName: "LifeDeux" });

  const operation = await db.operation.upsert({
    where: { slug: "prothese-penienne" },
    update: {},
    create: {
      slug: "prothese-penienne",
      nameFr: "Prothèse pénienne",
      nameEn: "Penile prosthesis",
      nameAr: "زرع البدلة القضيبية",
      descriptionFr:
        "Pose d'un implant pénien pour traiter une dysfonction érectile lorsque les autres traitements n'ont pas fonctionné. Intervention sous anesthésie, courte hospitalisation puis convalescence encadrée.",
      descriptionEn:
        "Placement of a penile implant to treat erectile dysfunction when other treatments have not worked. Performed under anaesthesia, with a short hospital stay followed by supervised recovery.",
      descriptionAr:
        "زرع بدلة قضيبية لعلاج ضعف الانتصاب عندما لا تنجح العلاجات الأخرى. تُجرى تحت التخدير مع إقامة قصيرة في المصحّة ثم فترة نقاهة مؤطَّرة.",
      basePrice: 590000,
      defaultRecoveryNights: 7,
    },
  });

  if (process.env.SEED_DEMO !== "true") {
    console.log("Seed done (production mode: no demo data).");
    return;
  }

  const demoPassword = process.env.DEMO_PASSWORD ?? "Demo12345!";
  const doctors = [
    {
      email: "dr.ben-salah@demo.lifedeux.com",
      firstName: "Karim",
      lastName: "Ben Salah",
      specialty: "Urologue — chirurgie andrologique",
      clinicName: "Clinique Les Jasmins",
      clinicAddress: "Avenue du Japon, Montplaisir, Tunis",
      city: "Tunis",
      years: 18,
      languages: ["Français", "العربية", "English"],
      price: 590000,
      fee: 350000,
    },
    {
      email: "dr.trabelsi@demo.lifedeux.com",
      firstName: "Sami",
      lastName: "Trabelsi",
      specialty: "Urologue — implants péniens",
      clinicName: "Polyclinique du Lac",
      clinicAddress: "Rue du Lac Windermere, Les Berges du Lac, Tunis",
      city: "Tunis",
      years: 12,
      languages: ["Français", "العربية", "Italiano"],
      price: 550000,
      fee: 320000,
    },
    {
      email: "dr.gharbi@demo.lifedeux.com",
      firstName: "Leila",
      lastName: "Gharbi",
      specialty: "Chirurgienne urologue",
      clinicName: "Clinique Hannibal",
      clinicAddress: "Boulevard de la Corniche, Sousse",
      city: "Sousse",
      years: 15,
      languages: ["Français", "العربية", "English", "Deutsch"],
      price: 620000,
      fee: 370000,
    },
  ];

  for (const d of doctors) {
    const user = await upsertUser({
      email: d.email,
      password: demoPassword,
      role: "DOCTOR",
      firstName: d.firstName,
      lastName: d.lastName,
      phone: "+216 00 000 000",
    });
    const doctor = await db.doctor.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        specialty: d.specialty,
        bio: `[Profil de démonstration] ${d.specialty}, ${d.years} ans d'expérience. Prise en charge des patients venant de l'étranger, consultation pré-opératoire la veille de l'intervention et suivi pendant toute la convalescence.`,
        languages: d.languages,
        clinicName: d.clinicName,
        clinicAddress: d.clinicAddress,
        city: d.city,
        yearsOfExperience: d.years,
        operations: { create: { operationId: operation.id, price: d.price, doctorFee: d.fee } },
      },
    });
    // Weekday slots at 09:00 and 13:00 (Tunisia time) for the next 60 days.
    const slots: Date[] = [];
    for (let i = 4; i < 64; i++) {
      const day = new Date(Date.now() + i * DAY);
      const weekday = day.getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      const key = day.toISOString().slice(0, 10);
      slots.push(new Date(`${key}T09:00:00+01:00`), new Date(`${key}T13:00:00+01:00`));
    }
    await db.slot.createMany({ data: slots.map((startsAt) => ({ doctorId: doctor.id, startsAt })), skipDuplicates: true });
  }

  if ((await db.accommodation.count()) === 0) {
    await db.accommodation.createMany({
      data: [
        {
          title: "Appartement lumineux aux Berges du Lac",
          type: "APARTMENT",
          city: "Tunis",
          address: "Les Berges du Lac 2, Tunis",
          description: "Appartement calme au 3e étage avec ascenseur, à 10 minutes des cliniques. Idéal pour une personne seule ou un couple.",
          pricePerNight: 6000,
          capacity: 2,
          bedrooms: 1,
          amenities: ["Wi-Fi", "Climatisation", "Ascenseur", "Cuisine équipée"],
          photos: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80"],
        },
        {
          title: "Maison avec jardin à La Marsa",
          type: "HOUSE",
          city: "La Marsa",
          address: "Rue Taïeb Mhiri, La Marsa",
          description: "Maison de plain-pied avec jardin, parfaite pour une convalescence au calme avec vos proches.",
          pricePerNight: 11000,
          capacity: 4,
          bedrooms: 2,
          amenities: ["Wi-Fi", "Climatisation", "Jardin", "Plain-pied", "Parking"],
          photos: ["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80"],
        },
        {
          title: "Studio confort Montplaisir",
          type: "APARTMENT",
          city: "Tunis",
          address: "Montplaisir, Tunis",
          description: "Studio moderne à deux pas des cliniques de Montplaisir.",
          pricePerNight: 4500,
          capacity: 1,
          bedrooms: 1,
          amenities: ["Wi-Fi", "Climatisation", "Ascenseur"],
          photos: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80"],
        },
        {
          title: "Villa familiale à Sousse",
          type: "HOUSE",
          city: "Sousse",
          address: "Zone touristique, Sousse",
          description: "Grande villa proche de la corniche, pour venir accompagné en toute sérénité.",
          pricePerNight: 14000,
          capacity: 5,
          bedrooms: 3,
          amenities: ["Wi-Fi", "Climatisation", "Piscine", "Parking", "Plain-pied"],
          photos: ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80"],
        },
      ],
    });
  }

  await upsertUser({
    email: "agent@demo.lifedeux.com",
    password: demoPassword,
    role: "AGENT",
    firstName: "Mehdi",
    lastName: "Agent",
    phone: "+216 00 000 001",
  });
  await upsertUser({
    email: "patient@demo.lifedeux.com",
    password: demoPassword,
    role: "PATIENT",
    firstName: "Jean",
    lastName: "Dupont",
    phone: "+33 6 00 00 00 00",
    country: "France",
  });

  console.log(`Seed done with demo data (demo password: ${demoPassword}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
