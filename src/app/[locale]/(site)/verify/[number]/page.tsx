import { BadgeCheck, ShieldAlert } from "lucide-react";
import { Container } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { db } from "@/lib/db";
import { contentHash, loadPrescription } from "@/lib/prescriptions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("verify.title"), robots: { index: false } };
}

/** Public page reached from the prescription QR code, e.g. by a pharmacist. */
export default async function VerifyPage({ params }: { params: Promise<{ locale: string; number: string }> }) {
  const { locale: raw, number } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const p = /^RX-\d{8}-[0-9A-F]{8}$/.test(number) ? await loadPrescription({ number }) : null;
  const authentic = !!p && p.status === "ISSUED" && !!p.contentHash && contentHash(p) === p.contentHash;
  const revoked = !!p && p.status === "REVOKED";
  const replacement = revoked && p.replacedById ? await db.prescription.findUnique({ where: { id: p.replacedById }, select: { number: true } }) : null;

  return (
    <Container className="max-w-2xl py-14">
      <div
        className={`rounded-3xl border-2 p-8 ${authentic ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"}`}
        data-testid={authentic ? "verify-ok" : "verify-bad"}
      >
        <div className="flex items-center gap-4">
          {authentic ? (
            <BadgeCheck className="h-12 w-12 shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <ShieldAlert className="h-12 w-12 shrink-0 text-red-600" aria-hidden />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-ink">{authentic ? t("verify.ok") : t("verify.bad")}</h1>
            <p className="font-mono text-sm text-muted">{number}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-ink">{authentic ? t("verify.okText") : t("verify.badText")}</p>
      </div>

      {revoked && p && (
        <div className="mt-6 rounded-3xl border-2 border-amber-200 bg-amber-50 p-6 text-sm text-amber-950" data-testid="verify-revoked">
          <p className="font-semibold">{t("verify.revoked", { date: p.revokedAt ? formatDateTime(p.revokedAt, locale) : "—" })}</p>
          {replacement?.number && <p className="mt-1">{t("verify.replacedBy", { number: replacement.number })}</p>}
        </div>
      )}

      {authentic && p && (
        <div className="mt-8 space-y-6 rounded-3xl border border-line p-8">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">{t("verify.doctor")}</dt>
              <dd className="font-semibold text-ink">
                Dr {p.doctor.user.firstName} {p.doctor.user.lastName}
              </dd>
              <dd className="text-muted">
                {p.doctor.specialty_ ? localized(p.doctor.specialty_, "name", locale) : p.doctor.specialty}
                {p.doctor.licenseNumber ? ` · ${p.doctor.licenseNumber}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t("verify.issuedAt")}</dt>
              <dd className="font-semibold text-ink">{p.issuedAt ? formatDateTime(p.issuedAt, locale) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("verify.patient")}</dt>
              <dd className="font-semibold text-ink">
                {p.patient.firstName} {p.patient.lastName.charAt(0)}.
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t("verify.fingerprint")}</dt>
              <dd className="font-mono text-xs text-ink">{p.contentHash!.slice(0, 16).toUpperCase()}</dd>
            </div>
          </dl>
          <div>
            <h2 className="mb-3 font-semibold text-ink">{t("verify.items")}</h2>
            <ol className="space-y-3">
              {p.items.map((i, index) => (
                <li key={i.id} className="rounded-xl bg-surface p-4 text-sm" data-testid="verify-item">
                  <p className="font-semibold text-ink">
                    {index + 1}. {i.name}
                  </p>
                  <p className="text-muted">
                    {i.dosage} · {i.frequency} · {i.duration}
                  </p>
                  {i.instructions && <p className="mt-1 italic text-muted">{i.instructions}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Container>
  );
}
