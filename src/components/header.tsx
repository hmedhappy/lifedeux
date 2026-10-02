import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { getT, type Locale } from "@/lib/i18n";
import { logoutAction } from "@/actions/auth";
import { HowItWorksButton } from "./how-it-works";
import { LanguageSwitcher } from "./language-switcher";
import { FooterGate } from "./footer-gate";
import { UserMenu } from "./user-menu";
import { Container } from "./ui";
import { MedelysLogo, MedelysMark } from "./brand-logo";

/** The Medelys monogram: the M with its leaf and cross. */
export function LogoMark({ className = "h-8 w-8", white = false }: { className?: string; white?: boolean }) {
  return <MedelysMark className={className} white={white} />;
}

export function Logo({ locale, inverted = false, href }: { locale: Locale; inverted?: boolean; href?: string }) {
  return (
    <Link href={href ?? `/${locale}`} className="flex shrink-0 items-center" aria-label="Medelys">
      <MedelysLogo className="h-8 w-auto md:h-9" white={inverted} />
    </Link>
  );
}

const navLink = "rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-surface hover:text-ink";

/**
 * `site`: public pages and patient space (marketing links, "Comment ça marche").
 * `pro`: doctor, admin and agent spaces — no marketing links, the space name instead.
 */
export async function Header({ locale, variant = "site", spaceLabel }: { locale: Locale; variant?: "site" | "pro"; spaceLabel?: string }) {
  const t = getT(locale);
  const user = await getCurrentUser();
  const home = user ? homeFor(user.role) : "/account";
  const homeLabel = !user || user.role === "PATIENT" ? t("nav.myBookings") : t("nav.dashboard");

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-3 md:h-[72px]">
        <div className="flex min-w-0 items-center gap-3">
          <Logo locale={locale} href={variant === "pro" ? `/${locale}${home}` : undefined} />
          {variant === "pro" && spaceLabel && (
            <span className="hidden rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-dark sm:inline">{spaceLabel}</span>
          )}
        </div>
        {variant === "site" && (
          <nav className="hidden items-center gap-1 md:flex">
            <Link href={`/${locale}/doctors`} className={navLink}>
              {t("nav.consult")}
            </Link>
            <Link href={`/${locale}/surgery`} className={navLink}>
              {t("nav.surgery")}
            </Link>
            <Link href={`/${locale}/stays`} className={navLink}>
              {t("nav.stays")}
            </Link>
            <Link href={`/${locale}${home}`} className={navLink} data-testid="nav-home-link">
              {homeLabel}
            </Link>
          </nav>
        )}
        <div className="flex items-center gap-1">
          {variant === "site" && <HowItWorksButton />}
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
          <UserMenu
            user={user ? { name: `${user.firstName} ${user.lastName}`, email: user.email, role: user.role } : null}
            homeHref={`/${locale}${home}`}
            homeLabel={homeLabel}
            logout={logoutAction.bind(null, locale)}
          />
        </div>
      </Container>
    </header>
  );
}

export async function Footer({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <FooterGate>
      <footer className="no-print mt-20 border-t border-line bg-white">
        <Container className="grid gap-8 py-10 text-sm sm:grid-cols-3">
          <div>
            <Logo locale={locale} />
            <p className="mt-3 max-w-xs text-muted">{t("footer.about")}</p>
          </div>
          <div>
            <p className="font-semibold text-ink">{t("footer.platform")}</p>
            <ul className="mt-3 space-y-2 text-muted">
              <li>
                <Link href={`/${locale}/doctors`} className="hover:text-ink">
                  {t("nav.consult")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/surgery`} className="hover:text-ink">
                  {t("nav.surgery")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/stays`} className="hover:text-ink">
                  {t("nav.stays")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/login`} className="hover:text-ink">
                  {t("footer.proAccess")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-ink">{t("footer.privacyTitle")}</p>
            <p className="mt-3 text-muted">{t("footer.privacy")}</p>
          </div>
        </Container>
        <Container className="border-t border-line py-6 text-xs text-muted">
          © {new Date().getFullYear()} Medelys · {t("footer.rights")}
        </Container>
      </footer>
    </FooterGate>
  );
}
