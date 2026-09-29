/** Plain helpers (no server-only import) so seed scripts can issue prescriptions too. */
import { createHash, randomBytes } from "node:crypto";

export function prescriptionNumber(now = new Date()): string {
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `RX-${day}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** What the fingerprint covers: any change to these fields breaks verification. */
export function canonicalContent(p: {
  number: string | null;
  issuedAt: Date | null;
  notes: string | null;
  doctor: { licenseNumber: string | null; user: { firstName: string; lastName: string } };
  patient: { firstName: string; lastName: string };
  items: { name: string; dosage: string; frequency: string; duration: string; instructions: string | null }[];
}): string {
  return JSON.stringify({
    number: p.number,
    issuedAt: p.issuedAt?.toISOString() ?? null,
    doctor: { name: `${p.doctor.user.firstName} ${p.doctor.user.lastName}`, license: p.doctor.licenseNumber },
    patient: `${p.patient.firstName} ${p.patient.lastName}`,
    items: p.items.map((i) => [i.name, i.dosage, i.frequency, i.duration, i.instructions ?? ""]),
    notes: p.notes ?? "",
  });
}

export function contentHash(p: Parameters<typeof canonicalContent>[0]): string {
  return createHash("sha256").update(canonicalContent(p)).digest("hex");
}
