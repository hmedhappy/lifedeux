/**
 * Seeds the platform settings, the first admin account and the reference data
 * (specialties, procedures, medications).
 * With SEED_DEMO=true (or `npm run db:seed:demo`) it also creates clearly-marked
 * demo doctors in several specialties (one super-doctor), stays, slots, an agent,
 * patients, bookings and online consultations in every state, so each business
 * scenario can be tried end to end. Safe to run several times.
 */
import { PrismaClient, type ConsultationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { contentHash, prescriptionNumber } from "../src/lib/prescription-hash";
import { demoPhoto, demoSignature, demoStamp } from "./lib/demo-images";
import { seedReference } from "./lib/seed-reference";

const db = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;

async function upsertUser(data: {
  email: string;
  password: string;
  role: "ADMIN" | "DOCTOR" | "SUPER_DOCTOR" | "AGENT" | "PATIENT";
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

  const counts = await seedReference(db);
  console.log("Reference data:", counts);
  const operation = await db.operation.findUniqueOrThrow({ where: { slug: "prothese-penienne" } });

  const demo = process.env.SEED_DEMO === "true" || process.argv.includes("--demo");
  if (!demo) {
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
    const urology = await db.specialty.findUniqueOrThrow({ where: { slug: "urology" } });
    const doctor = await db.doctor.upsert({
      where: { userId: user.id },
      update: { specialtyId: urology.id },
      create: {
        userId: user.id,
        specialtyId: urology.id,
        licenseNumber: `TN-URO-${d.years}${d.lastName.length}`,
        consultationPrice: 9000,
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
    await ensureSignatureImages(doctor.id);
    await createConsultationSlots(doctor.id, ["17:00", "17:30"]);
  }

  const superDoctor = await seedConsultationDoctors(demoPassword);

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
  const patients = [
    { email: "patient@demo.lifedeux.com", firstName: "Jean", lastName: "Dupont", phone: "+33 6 00 00 00 00", country: "France", locale: "fr" },
    { email: "sara@demo.lifedeux.com", firstName: "Sara", lastName: "Haddad", phone: "+1 514 000 0000", country: "Canada", locale: "fr" },
    { email: "luca@demo.lifedeux.com", firstName: "Luca", lastName: "Rossi", phone: "+39 300 000 0000", country: "Italie", locale: "en" },
    { email: "youssef@demo.lifedeux.com", firstName: "Youssef", lastName: "Amrani", phone: "+212 600 000 000", country: "Maroc", locale: "ar" },
    { email: "nadia@demo.lifedeux.com", firstName: "Nadia", lastName: "Ben Ali", phone: "+216 20 000 000", country: "Tunisie", locale: "fr" },
  ];
  const patientIds: Record<string, string> = {};
  for (const p of patients) {
    const user = await upsertUser({ ...p, password: demoPassword, role: "PATIENT" });
    patientIds[p.email] = user.id;
  }

  await seedSampleBookings(patientIds);
  await seedSampleConsultations(patientIds);
  await seedRelookingDemo();

  console.log(`\nSeed done with demo data. Password for every demo account: ${demoPassword}\n`);
  console.table([
    { role: "ADMIN", email: adminEmail.toLowerCase(), password: "(ADMIN_PASSWORD)", note: "" },
    { role: "SUPER_DOCTOR", email: superDoctor.email, password: demoPassword, note: `/fr/join/${SUPER_CODE}` },
    ...CONSULT_DOCTORS.filter((d) => !d.superDoctor).map((d) => ({
      role: "DOCTOR",
      email: d.email,
      password: demoPassword,
      note: d.specialty + (d.stamp ? "" : " (sans cachet)") + (d.referred ? " (parrainé)" : ""),
    })),
    ...doctors.map((d) => ({ role: "DOCTOR", email: d.email, password: demoPassword, note: "urology + prothèse" })),
    { role: "AGENT", email: "agent@demo.lifedeux.com", password: demoPassword, note: "" },
    ...patients.map((p) => ({ role: "PATIENT", email: p.email, password: demoPassword, note: p.country })),
  ]);
}

/**
 * One booking per state so each dashboard has something to show:
 * a request waiting for the doctor, a confirmed booking waiting for payment,
 * and a paid stay with accommodation and a companion (QR pass ready).
 */
async function seedSampleBookings(patientIds: Record<string, string>) {
  const settings = await db.setting.findUniqueOrThrow({ where: { id: 1 } });
  const operation = await db.operation.findUniqueOrThrow({ where: { slug: "prothese-penienne" } });
  const doctorByEmail = async (email: string) =>
    db.doctor.findFirstOrThrow({ where: { user: { email } }, include: { operations: true } });

  async function freeSlot(doctorId: string, minDays: number) {
    return db.slot.findFirstOrThrow({
      where: { doctorId, status: "FREE", startsAt: { gt: new Date(Date.now() + minDays * DAY) } },
      orderBy: { startsAt: "asc" },
    });
  }

  const samples = [
    { reference: "LD-DEMO01", patient: "sara@demo.lifedeux.com", doctor: "dr.trabelsi@demo.lifedeux.com", minDays: 6, state: "REQUESTED" as const },
    { reference: "LD-DEMO02", patient: "luca@demo.lifedeux.com", doctor: "dr.ben-salah@demo.lifedeux.com", minDays: 9, state: "CONFIRMED" as const },
    { reference: "LD-DEMO03", patient: "youssef@demo.lifedeux.com", doctor: "dr.gharbi@demo.lifedeux.com", minDays: 20, state: "PAID" as const },
  ];

  for (const sample of samples) {
    if (await db.booking.findUnique({ where: { reference: sample.reference } })) continue;
    const doctor = await doctorByEmail(sample.doctor);
    const offer = doctor.operations.find((o) => o.operationId === operation.id);
    if (!offer) continue;
    const slot = await freeSlot(doctor.id, sample.minDays);
    const recoveryNights = operation.defaultRecoveryNights;
    const base = {
      reference: sample.reference,
      patientId: patientIds[sample.patient],
      doctorId: doctor.id,
      operationId: operation.id,
      slotId: slot.id,
      recoveryNights,
      operationPrice: offer.price,
      totalAmount: offer.price,
      doctorFee: offer.doctorFee,
      currency: settings.currency,
    };

    if (sample.state === "REQUESTED") {
      await db.$transaction([
        db.slot.update({ where: { id: slot.id }, data: { status: "HELD" } }),
        db.booking.create({ data: { ...base, patientNote: "Je voyage depuis Montréal, arrivée possible la veille au soir." } }),
      ]);
    } else if (sample.state === "CONFIRMED") {
      await db.$transaction([
        db.slot.update({ where: { id: slot.id }, data: { status: "HELD" } }),
        db.booking.create({
          data: {
            ...base,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            paymentDeadline: new Date(Date.now() + settings.paymentDeadlineHours * 60 * 60 * 1000),
          },
        }),
      ]);
    } else {
      const villa = await db.accommodation.findFirst({ where: { title: "Villa familiale à Sousse" } });
      const nights = recoveryNights + 1;
      const transportPrice = settings.transportPricePerPerson * 2;
      const accommodationPrice = villa ? villa.pricePerNight * nights : 0;
      const totalAmount = offer.price + transportPrice + accommodationPrice;
      await db.$transaction([
        db.slot.update({ where: { id: slot.id }, data: { status: "BOOKED" } }),
        db.booking.create({
          data: {
            ...base,
            status: "PAID",
            optionsChosen: true,
            withTransport: true,
            accommodationId: villa?.id ?? null,
            companionsCount: 1,
            arrivalDate: new Date(slot.startsAt.getTime() - DAY),
            departureDate: new Date(slot.startsAt.getTime() + recoveryNights * DAY),
            nights,
            transportPrice,
            accommodationPrice,
            totalAmount,
            confirmedAt: new Date(),
            paidAt: new Date(),
            qrToken: `demo-${randomBytes(18).toString("base64url")}`,
            companions: { create: { firstName: "Salma", lastName: "Amrani", passportNumber: "MA1234567" } },
            payments: { create: { provider: "mock", providerRef: `mock_${sample.reference}`, amount: totalAmount, currency: settings.currency, status: "SUCCEEDED" } },
          },
        }),
      ]);
    }
  }
}

/* --------------------------- Online consultations --------------------------- */

/** Fixed so the referral link of the demo super-doctor is easy to test. */
const SUPER_CODE = "DR-DEMOSUPER";

type ConsultDoctor = {
  email: string;
  firstName: string;
  lastName: string;
  specialty: string;
  slug: string;
  city: string;
  clinicName: string;
  years: number;
  stamp: boolean;
  superDoctor?: boolean;
  referred?: boolean;
  operation?: { slug: string; price: number; fee: number };
};

const CONSULT_DOCTORS: ConsultDoctor[] = [
  { email: "dr.mansour@demo.lifedeux.com", firstName: "Hichem", lastName: "Mansour", specialty: "Médecin généraliste", slug: "general-medicine", city: "Tunis", clinicName: "Cabinet Mansour", years: 22, stamp: true, superDoctor: true },
  { email: "dr.jaziri@demo.lifedeux.com", firstName: "Amine", lastName: "Jaziri", specialty: "Cardiologue", slug: "cardiology", city: "Tunis", clinicName: "Centre Cardio El Menzah", years: 16, stamp: true },
  { email: "dr.amira@demo.lifedeux.com", firstName: "Amira", lastName: "Trabelsi", specialty: "Dermatologue", slug: "dermatology", city: "Sfax", clinicName: "Clinique Dermatologique de Sfax", years: 11, stamp: true },
  { email: "dr.chaabane@demo.lifedeux.com", firstName: "Ines", lastName: "Chaabane", specialty: "Psychologue clinicienne", slug: "psychology", city: "Tunis", clinicName: "Cabinet Écoute & Soin", years: 9, stamp: false },
  { email: "dr.khelifi@demo.lifedeux.com", firstName: "Rym", lastName: "Khelifi", specialty: "Pédiatre", slug: "pediatrics", city: "Sousse", clinicName: "Cabinet Les Petits Pas", years: 13, stamp: true },
  { email: "dr.mejri@demo.lifedeux.com", firstName: "Sonia", lastName: "Mejri", specialty: "Gynécologue-obstétricienne", slug: "gynecology", city: "Tunis", clinicName: "Clinique La Rose", years: 19, stamp: true },
  { email: "dr.hamdi@demo.lifedeux.com", firstName: "Walid", lastName: "Hamdi", specialty: "Ophtalmologue — chirurgie de la cataracte", slug: "ophthalmology", city: "Tunis", clinicName: "Clinique de la Vision", years: 17, stamp: true, operation: { slug: "cataracte", price: 250000, fee: 150000 } },
  { email: "dr.bouaziz@demo.lifedeux.com", firstName: "Mehdi", lastName: "Bouaziz", specialty: "Chirurgien-dentiste implantologue", slug: "dentistry", city: "Monastir", clinicName: "Centre Dentaire Monastir", years: 10, stamp: true, operation: { slug: "implant-dentaire", price: 180000, fee: 110000 } },
  { email: "dr.karoui@demo.lifedeux.com", firstName: "Yassine", lastName: "Karoui", specialty: "Neurologue", slug: "neurology", city: "Tunis", clinicName: "Cabinet de Neurologie Karoui", years: 8, stamp: true, referred: true },
];

async function ensureSignatureImages(doctorId: string, withStamp = true) {
  const doctor = await db.doctor.findUniqueOrThrow({ where: { id: doctorId } });
  const data: { stampImageId?: string; signatureImageId?: string } = {};
  if (withStamp && !doctor.stampImageId) {
    const bytes = demoStamp();
    data.stampImageId = (await db.image.create({ data: { mime: "image/png", size: bytes.byteLength, data: bytes, private: true } })).id;
  }
  if (!doctor.signatureImageId) {
    const bytes = demoSignature();
    data.signatureImageId = (await db.image.create({ data: { mime: "image/png", size: bytes.byteLength, data: bytes, private: true } })).id;
  }
  if (Object.keys(data).length) await db.doctor.update({ where: { id: doctorId }, data });
}

/** Weekday consultation slots (Tunisia time) from tomorrow for the next 30 days. */
async function createConsultationSlots(doctorId: string, times = ["10:00", "10:30", "11:00", "15:00", "15:30", "16:00"]) {
  const slots: Date[] = [];
  for (let i = 1; i < 31; i++) {
    const day = new Date(Date.now() + i * DAY);
    if (day.getUTCDay() === 0) continue;
    const key = day.toISOString().slice(0, 10);
    for (const time of times) slots.push(new Date(`${key}T${time}:00+01:00`));
  }
  await db.slot.createMany({ data: slots.map((startsAt) => ({ doctorId, startsAt, kind: "CONSULTATION" as const })), skipDuplicates: true });
}

async function seedConsultationDoctors(password: string) {
  let superDoctorId: string | null = null;
  for (const d of CONSULT_DOCTORS) {
    const specialty = await db.specialty.findUniqueOrThrow({ where: { slug: d.slug } });
    const user = await upsertUser({
      email: d.email,
      password,
      role: d.superDoctor ? "SUPER_DOCTOR" : "DOCTOR",
      firstName: d.firstName,
      lastName: d.lastName,
      phone: "+216 00 000 010",
    });
    const operation = d.operation ? await db.operation.findUnique({ where: { slug: d.operation.slug } }) : null;
    const doctor: { id: string } = await db.doctor.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        specialty: d.specialty,
        specialtyId: specialty.id,
        licenseNumber: `TN-${d.slug.slice(0, 3).toUpperCase()}-${1000 + d.years * 37}`,
        bio: `[Profil de démonstration] ${d.specialty} depuis ${d.years} ans. Consultations en ligne par chat pour les patients en Tunisie et à l'étranger${d.operation ? ", et prise en charge chirurgicale complète à la clinique" : ""}.`,
        languages: ["Français", "العربية", "English"],
        clinicName: d.clinicName,
        clinicAddress: "Avenue Habib Bourguiba",
        city: d.city,
        yearsOfExperience: d.years,
        referralCode: d.superDoctor ? SUPER_CODE : null,
        referredById: d.referred ? superDoctorId : null,
        operations: operation && d.operation ? { create: { operationId: operation.id, price: d.operation.price, doctorFee: d.operation.fee } } : undefined,
      },
    });
    if (d.superDoctor) superDoctorId = doctor.id;
    // Referred demo doctors are already checked by the admin, so they are visible.
    if (d.referred) await db.doctor.updateMany({ where: { id: doctor.id, verifiedAt: null }, data: { verifiedAt: new Date() } });
    await ensureSignatureImages(doctor.id, d.stamp);
    await createConsultationSlots(doctor.id);
    if (operation) {
      const slots: Date[] = [];
      for (let i = 5; i < 60; i += 2) {
        const key = new Date(Date.now() + i * DAY).toISOString().slice(0, 10);
        slots.push(new Date(`${key}T08:30:00+01:00`));
      }
      await db.slot.createMany({ data: slots.map((startsAt) => ({ doctorId: doctor.id, startsAt })), skipDuplicates: true });
    }
  }
  return CONSULT_DOCTORS.find((d) => d.superDoctor)!;
}

/**
 * One consultation per state. LC-DEMO03 is moved to "now" on every run so a
 * live chat is always available to try; LC-DEMO05 carries an issued prescription.
 */
async function seedSampleConsultations(patientIds: Record<string, string>) {
  const settings = await db.setting.findUniqueOrThrow({ where: { id: 1 } });
  const minute = 60_000;
  const now = Math.floor(Date.now() / (5 * minute)) * 5 * minute;
  const samples: { reference: string; patient: string; doctor: string; status: ConsultationStatus; at: number; reason: string }[] = [
    { reference: "LC-DEMO01", patient: "nadia@demo.lifedeux.com", doctor: "dr.jaziri@demo.lifedeux.com", status: "REQUESTED", at: now + 2 * DAY + 90 * minute, reason: "Palpitations le soir depuis deux semaines." },
    { reference: "LC-DEMO02", patient: "patient@demo.lifedeux.com", doctor: "dr.amira@demo.lifedeux.com", status: "CONFIRMED", at: now + 3 * DAY, reason: "Plaques rouges sur les avant-bras." },
    { reference: "LC-DEMO03", patient: "sara@demo.lifedeux.com", doctor: "dr.amira@demo.lifedeux.com", status: "PAID", at: now - 5 * minute, reason: "Grain de beauté qui change d'aspect." },
    { reference: "LC-DEMO04", patient: "luca@demo.lifedeux.com", doctor: "dr.khelifi@demo.lifedeux.com", status: "PAID", at: now + DAY + 2 * 60 * minute, reason: "Fièvre de mon fils (4 ans) depuis hier." },
    { reference: "LC-DEMO05", patient: "youssef@demo.lifedeux.com", doctor: "dr.mansour@demo.lifedeux.com", status: "COMPLETED", at: now - 2 * DAY, reason: "Angine, douleur à la déglutition." },
    { reference: "LC-DEMO06", patient: "patient@demo.lifedeux.com", doctor: "dr.jaziri@demo.lifedeux.com", status: "REFUSED", at: now + 4 * DAY, reason: "Bilan cardiaque." },
    { reference: "LC-DEMO07", patient: "luca@demo.lifedeux.com", doctor: "dr.amira@demo.lifedeux.com", status: "EXPIRED", at: now - DAY, reason: "Acné." },
    { reference: "LC-DEMO08", patient: "nadia@demo.lifedeux.com", doctor: "dr.khelifi@demo.lifedeux.com", status: "CANCELLED", at: now + 5 * DAY, reason: "Vaccins." },
  ];

  for (const sample of samples) {
    const doctor = await db.doctor.findFirstOrThrow({ where: { user: { email: sample.doctor } }, include: { user: true, specialty_: true } });
    const existing = await db.consultation.findUnique({ where: { reference: sample.reference }, include: { slot: true } });
    if (existing) {
      if (sample.reference === "LC-DEMO03" && existing.status === "PAID") {
        await db.slot.deleteMany({ where: { doctorId: doctor.id, startsAt: new Date(sample.at), id: { not: existing.slotId }, status: "FREE" } });
        await db.slot.update({ where: { id: existing.slotId }, data: { startsAt: new Date(sample.at) } }).catch(() => undefined);
      }
      continue;
    }
    const price = doctor.consultationPrice ?? doctor.specialty_?.consultationPrice ?? 5000;
    const fee = doctor.consultationFee ?? Math.round(price * 0.7);
    const slotStatus = sample.status === "PAID" || sample.status === "COMPLETED" ? "BOOKED" : sample.status === "REQUESTED" || sample.status === "CONFIRMED" ? "HELD" : "FREE";
    const slot = await db.slot.upsert({
      where: { doctorId_startsAt: { doctorId: doctor.id, startsAt: new Date(sample.at) } },
      update: { status: slotStatus, kind: "CONSULTATION" },
      create: { doctorId: doctor.id, startsAt: new Date(sample.at), status: slotStatus, kind: "CONSULTATION" },
    });
    const paid = sample.status === "PAID" || sample.status === "COMPLETED";
    const c = await db.consultation.create({
      data: {
        reference: sample.reference,
        patientId: patientIds[sample.patient],
        doctorId: doctor.id,
        slotId: slot.id,
        status: sample.status,
        reason: sample.reason,
        durationMinutes: doctor.consultationMinutes,
        price,
        doctorFee: fee,
        currency: settings.currency,
        refusalReason: sample.status === "REFUSED" ? "Un examen en cabinet est nécessaire : merci de prendre rendez-vous sur place." : null,
        confirmedAt: sample.status === "REQUESTED" || sample.status === "REFUSED" ? null : new Date(),
        paymentDeadline: sample.status === "CONFIRMED" ? new Date(Date.now() + settings.paymentDeadlineHours * 3_600_000) : sample.status === "EXPIRED" ? new Date(Date.now() - 2 * DAY) : null,
        paidAt: paid ? new Date() : null,
        endedAt: sample.status === "COMPLETED" ? new Date(sample.at + 30 * minute) : null,
        cancelledAt: sample.status === "CANCELLED" ? new Date() : null,
        payments: paid
          ? { create: { provider: "mock", providerRef: `mock_${sample.reference}`, amount: price, currency: settings.currency, status: "SUCCEEDED" } }
          : undefined,
      },
    });

    if (sample.reference === "LC-DEMO03") {
      const photo = demoPhoto();
      const image = await db.image.create({ data: { mime: "image/png", size: photo.byteLength, data: photo, private: true, consultationId: c.id } });
      const patientId = patientIds[sample.patient];
      await db.message.createMany({
        data: [
          { consultationId: c.id, senderId: doctor.userId, kind: "TEXT", text: "Bonjour Sara, je suis le Dr Trabelsi. Pouvez-vous m'envoyer une photo nette du grain de beauté ?", createdAt: new Date(sample.at + minute) },
          { consultationId: c.id, senderId: patientId, kind: "TEXT", text: "Bonjour Docteur, oui voici la photo prise ce matin.", createdAt: new Date(sample.at + 2 * minute) },
          { consultationId: c.id, senderId: patientId, kind: "IMAGE", imageId: image.id, createdAt: new Date(sample.at + 3 * minute) },
        ],
      });
    }

    if (sample.reference === "LC-DEMO05") {
      await seedIssuedPrescription(c.id, doctor.id, doctor.userId, patientIds[sample.patient], new Date(sample.at + 25 * minute));
    }
  }
}

async function seedIssuedPrescription(consultationId: string, doctorId: string, doctorUserId: string, patientId: string, issuedAt: Date) {
  const pick = async (name: string, strength: string) => db.medication.findFirst({ where: { name, strength } });
  const [augmentin, doliprane] = await Promise.all([pick("Augmentin", "1 g / 125 mg"), pick("Doliprane", "1 g")]);
  const items = [
    { position: 0, medicationId: augmentin?.id ?? null, name: "Augmentin 1 g / 125 mg · Comprimé", dosage: "1 comprimé", frequency: "2 fois par jour", duration: "7 jours", instructions: "Au début des repas." },
    { position: 1, medicationId: doliprane?.id ?? null, name: "Doliprane 1 g · Comprimé", dosage: "1 comprimé", frequency: "Jusqu'à 3 fois par jour", duration: "5 jours", instructions: "Espacer les prises d'au moins 6 heures." },
  ];
  const notes = "Consulter en cabinet si la fièvre persiste au-delà de 72 heures.";
  const prescription = await db.prescription.create({
    data: { consultationId, doctorId, patientId, notes, items: { create: items } },
    include: { items: { orderBy: { position: "asc" } }, patient: true, doctor: { include: { user: true } } },
  });
  const number = prescriptionNumber(issuedAt);
  const hash = contentHash({ ...prescription, number, issuedAt });
  await db.prescription.update({ where: { id: prescription.id }, data: { status: "ISSUED", number, issuedAt, contentHash: hash } });
  await db.message.createMany({
    data: [
      { consultationId, senderId: doctorUserId, kind: "TEXT", text: "Voici votre ordonnance. Bon rétablissement !", createdAt: new Date(issuedAt.getTime() - 60_000) },
      { consultationId, senderId: doctorUserId, kind: "PRESCRIPTION", prescriptionId: prescription.id, createdAt: issuedAt },
    ],
  });
}


main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

/** Review on the completed demo consultation and a saved prescription for Dr Amira. Idempotent. */
async function seedRelookingDemo() {
  const done = await db.consultation.findUnique({ where: { reference: "LC-DEMO05" } });
  if (done && !(await db.review.findUnique({ where: { consultationId: done.id } }))) {
    await db.review.create({
      data: { consultationId: done.id, doctorId: done.doctorId, patientId: done.patientId, rating: 5, text: "[Démo] Très à l'écoute, ordonnance reçue en quelques minutes." },
    });
  }
  const amira = await db.doctor.findFirst({ where: { user: { email: "dr.amira@demo.lifedeux.com" } } });
  if (amira && (await db.prescriptionFavorite.count({ where: { doctorId: amira.id } })) === 0) {
    await db.prescriptionFavorite.create({
      data: {
        doctorId: amira.id,
        name: "Eczéma adulte",
        items: [
          { medicationId: null, name: "Dermocorticoïde crème", dosage: "1 application", frequency: "le soir", duration: "7 jours", instructions: "Sur les plaques uniquement" },
          { medicationId: null, name: "Crème émolliente", dosage: "1 application", frequency: "matin et soir", duration: "1 mois", instructions: "" },
        ],
        notes: "Éviter les savons parfumés.",
      },
    });
  }
}
