/** What a doctor still needs before signing prescriptions ("prêt à prescrire"). */
export function prescriptionReadiness(d: { licenseNumber: string | null; stampImageId: string | null; signatureImageId: string | null }) {
  const missing = [!d.licenseNumber && "license", !d.stampImageId && "stamp", !d.signatureImageId && "signature"].filter(Boolean) as (
    | "license"
    | "stamp"
    | "signature"
  )[];
  return { ready: missing.length === 0, missing };
}
