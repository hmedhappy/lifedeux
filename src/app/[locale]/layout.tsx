import type { Metadata, Viewport } from "next";
import { Poppins, Tajawal } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { I18nProvider } from "@/components/i18n-provider";
import { ToastProvider } from "@/components/toast";
import { dir, getMessages, getT, isLocale, locales } from "@/lib/i18n";
import { appUrl } from "@/lib/settings";

// Medelys type: Poppins for Latin, Tajawal for Arabic. The CSS variable names predate the rebrand and are kept.
// 700 is loaded too because existing headings use font-bold.
const jakarta = Poppins({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-jakarta", display: "swap" });
const arabic = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700"], variable: "--font-arabic", display: "swap" });

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getT(locale);
  return {
    title: { default: `Medelys — ${t("common.tagline")}`, template: "%s · Medelys" },
    description: t("home.heroSubtitle"),
    metadataBase: new URL(appUrl()),
    applicationName: "Medelys",
    openGraph: { siteName: "Medelys", images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Medelys" }] },
    twitter: { card: "summary_large_image", images: ["/og-image.png"] },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { themeColor: "#014d7d" };

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} dir={dir(locale)} className={`${jakarta.variable} ${arabic.variable}`}>
      <body className="min-h-screen font-sans">
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
