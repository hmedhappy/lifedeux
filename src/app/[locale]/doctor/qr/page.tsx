import QRCode from "qrcode";
import { Building2, Download, ExternalLink } from "lucide-react";
import { MedelysLogo } from "@/components/brand-logo";
import { PrintButton } from "@/components/print-button";
import { Notice, PageTitle, buttonClass } from "@/components/ui";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, localized, toLocale } from "@/lib/i18n";
import { inPersonOffer } from "@/lib/queries";
import { appUrl } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("qr.title") };
}

/**
 * QR code for the practice desk: it opens the doctor's page on the "at the practice" tab.
 * The link has no language, so each patient lands in their phone's language.
 */
export default async function DoctorQrPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { doctor: me } = await requireDoctor(locale);
  const doctor = await db.doctor.findUniqueOrThrow({ where: { id: me.id }, include: { user: true, specialty_: true } });
  const link = `${appUrl()}/doctors/${doctor.id}?service=cabinet`;
  const svg = await QRCode.toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#12304f", light: "#ffffff" } });
  const png = await QRCode.toDataURL(link, { margin: 2, width: 1024, errorCorrectionLevel: "M", color: { dark: "#12304f", light: "#ffffff" } });
  const name = `Dr ${doctor.user.firstName} ${doctor.user.lastName}`;
  const specialty = doctor.specialty_ ? localized(doctor.specialty_, "name", locale) : doctor.specialty;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="no-print">
        <PageTitle title={t("qr.title")} subtitle={t("qr.subtitle")} />
        {!inPersonOffer(doctor) && (
          <Notice tone="warning">
            {t("qr.noInPerson")}{" "}
            <a href={`/${locale}/doctor/profile`} className="font-semibold underline">
              {t("qr.noInPersonLink")}
            </a>
          </Notice>
        )}
      </div>

      {/* The poster: printed as is (A5 / A4), everything else on the page is hidden when printing. */}
      <section className="qr-poster mx-auto flex max-w-sm flex-col items-center rounded-3xl border border-line bg-white p-8 text-center shadow-card" data-testid="qr-poster">
        <MedelysLogo className="h-8 w-auto" />
        <p className="mt-6 text-xl font-bold text-ink">{name}</p>
        <p className="text-sm text-muted">{specialty}</p>
        <div className="mt-6 w-56 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-6 flex items-center gap-2 text-lg font-semibold text-ink">
          <Building2 className="h-5 w-5 text-brand" aria-hidden />
          {t("qr.scan")}
        </p>
        <p className="mt-1 text-sm text-muted">{t("qr.scanHint")}</p>
      </section>

      <div className="no-print flex flex-wrap justify-center gap-2">
        <PrintButton label={t("qr.print")} />
        <a href={png} download={`medelys-qr-${doctor.user.lastName.toLowerCase().replace(/\s+/g, "-")}.png`} className={buttonClass("secondary")}>
          <Download className="h-4 w-4" aria-hidden />
          {t("qr.download")}
        </a>
        <a href={link} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost")}>
          <ExternalLink className="h-4 w-4" aria-hidden />
          {t("qr.open")}
        </a>
      </div>
      <p className="no-print break-all text-center text-xs text-muted" dir="ltr">
        {link}
      </p>
    </div>
  );
}
