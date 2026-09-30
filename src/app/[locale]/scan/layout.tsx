import { Header } from "@/components/header";
import { Container } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getT, toLocale } from "@/lib/i18n";

export default async function ScanLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = toLocale((await params).locale);
  await requireRole(locale, ["AGENT", "ADMIN"]);
  return (
    <>
      <Header locale={locale} variant="pro" spaceLabel={getT(locale)("scan.space")} />
      <Container className="max-w-3xl py-8">{children}</Container>
    </>
  );
}
