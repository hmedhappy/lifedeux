import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { getT, type Locale } from "@/lib/i18n";
import { logoutAction } from "@/actions/auth";
import { LanguageSwitcher } from "./language-switcher";
import { Avatar, Container } from "./ui";

export function Logo({ locale, inverted = false }: { locale: Locale; inverted?: boolean }) {
  return (
    <Link href={`/${locale}`} className={`flex items-center gap-2 ${inverted ? "text-white" : "text-brand"}`} aria-label="LifeDeux">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <path
          fill="currentColor"
          d="M16 29s-11-6.6-11-15.1C5 9.3 8.5 6 12.6 6c1.4 0 2.6.4 3.4 1.2C16.8 6.4 18 6 19.4 6 23.5 6 27 9.3 27 13.9 27 22.4 16 29 16 29z"
        />
        <path fill={inverted ? "#e31c5f" : "#fff"} d="M14.6 11h2.8v3.6H21v2.8h-3.6V21h-2.8v-3.6H11v-2.8h3.6z" />
      </svg>
      <span className="text-xl font-bold tracking-tight">lifedeux</span>
    </Link>
  );
}

export async function Header({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const user = await getCurrentUser();

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <Container className="flex h-20 items-center justify-between gap-4">
        <Logo locale={locale} />
        <nav className="hidden items-center gap-1 md:flex">
          <Link href={`/${locale}/doctors`} className="rounded-full px-4 py-2 text-sm font-medium text-ink hover:bg-surface">
            {t("nav.doctors")}
          </Link>
          <Link href={`/${locale}/stays`} className="rounded-full px-4 py-2 text-sm font-medium text-ink hover:bg-surface">
            {t("nav.stays")}
          </Link>
          <Link href={`/${locale}#how`} className="rounded-full px-4 py-2 text-sm font-medium text-ink hover:bg-surface">
            {t("nav.howItWorks")}
          </Link>
        </nav>
        <div className="flex items-center gap-1">
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
          <details className="relative">
            <summary
              aria-label={t("nav.menu")}
              data-testid="user-menu"
              className="flex cursor-pointer list-none items-center gap-2.5 rounded-full border border-line py-1.5 ps-3.5 pe-1.5 transition hover:shadow-float [&::-webkit-details-marker]:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              {user ? (
                <Avatar name={`${user.firstName} ${user.lastName}`} size={30} />
              ) : (
                <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-muted text-white">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                    <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z" />
                  </svg>
                </span>
              )}
            </summary>
            <div className="absolute end-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-white py-2 shadow-float">
              {user ? (
                <>
                  <p className="px-4 py-2 text-xs text-muted">{user.email}</p>
                  <Link href={`/${locale}${homeFor(user.role)}`} className="block px-4 py-2.5 text-sm font-semibold hover:bg-surface">
                    {user.role === "PATIENT" ? t("nav.myBookings") : t("nav.dashboard")}
                  </Link>
                  <Link href={`/${locale}/doctors`} className="block px-4 py-2.5 text-sm hover:bg-surface md:hidden">
                    {t("nav.doctors")}
                  </Link>
                  <hr className="my-2 border-line" />
                  <form action={logoutAction.bind(null, locale)}>
                    <button type="submit" className="block w-full px-4 py-2.5 text-start text-sm hover:bg-surface">
                      {t("nav.logout")}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href={`/${locale}/register`} className="block px-4 py-2.5 text-sm font-semibold hover:bg-surface">
                    {t("nav.register")}
                  </Link>
                  <Link href={`/${locale}/login`} className="block px-4 py-2.5 text-sm hover:bg-surface">
                    {t("nav.login")}
                  </Link>
                  <hr className="my-2 border-line" />
                  <Link href={`/${locale}/doctors`} className="block px-4 py-2.5 text-sm hover:bg-surface">
                    {t("nav.doctors")}
                  </Link>
                  <Link href={`/${locale}/stays`} className="block px-4 py-2.5 text-sm hover:bg-surface">
                    {t("nav.stays")}
                  </Link>
                </>
              )}
            </div>
          </details>
        </div>
      </Container>
    </header>
  );
}

export async function Footer({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <footer className="no-print mt-24 border-t border-line bg-surface">
      <Container className="grid gap-8 py-12 text-sm sm:grid-cols-3">
        <div>
          <Logo locale={locale} />
          <p className="mt-3 max-w-xs text-muted">{t("footer.about")}</p>
        </div>
        <div>
          <p className="font-semibold">{t("footer.platform")}</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li><Link href={`/${locale}/doctors`} className="hover:underline">{t("nav.doctors")}</Link></li>
            <li><Link href={`/${locale}/stays`} className="hover:underline">{t("nav.stays")}</Link></li>
            <li><Link href={`/${locale}/login`} className="hover:underline">{t("footer.proAccess")}</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">{t("footer.privacyTitle")}</p>
          <p className="mt-3 text-muted">{t("footer.privacy")}</p>
        </div>
      </Container>
      <Container className="border-t border-line py-6 text-xs text-muted">
        © {new Date().getFullYear()} LifeDeux · {t("footer.rights")}
      </Container>
    </footer>
  );
}
