"use client";

import { LogOut, Menu, UserRound } from "lucide-react";
import type { Role } from "@prisma/client";
import { useI18n } from "./i18n-provider";
import { Dropdown, MenuLink } from "./menu";
import { Avatar } from "./ui";

export function UserMenu({
  user,
  homeHref,
  homeLabel,
  logout,
}: {
  user: { name: string; email: string; role: Role } | null;
  homeHref: string;
  homeLabel: string;
  logout: () => Promise<void>;
}) {
  const { t, locale } = useI18n();
  return (
    <Dropdown
      label={t("nav.menu")}
      testId="user-menu"
      trigger={
        <span className="flex items-center gap-2 rounded-full border border-line py-1 ps-3 pe-1 transition hover:shadow-float">
          <Menu className="h-4 w-4 text-ink" aria-hidden />
          {user ? (
            <Avatar name={user.name} size={32} />
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-muted">
              <UserRound className="h-5 w-5" aria-hidden />
            </span>
          )}
        </span>
      }
    >
      {user ? (
        <>
          <div className="px-4 pb-2 pt-1">
            <p className="text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <hr className="my-1 border-line" />
          <MenuLink href={homeHref} strong>
            {homeLabel}
          </MenuLink>
          {user.role === "PATIENT" && <MenuLink href={`/${locale}/account/profile`}>{t("nav.profile")}</MenuLink>}
          <MenuLink href={`/${locale}/doctors`}>{t("nav.consult")}</MenuLink>
          <MenuLink href={`/${locale}/surgery`}>{t("nav.surgery")}</MenuLink>
          <hr className="my-1 border-line" />
          <form action={logout}>
            <button type="submit" className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-start text-sm hover:bg-surface">
              <LogOut className="h-4 w-4 text-muted" aria-hidden />
              {t("nav.logout")}
            </button>
          </form>
        </>
      ) : (
        <>
          <MenuLink href={`/${locale}/login`} strong>
            {t("nav.login")}
          </MenuLink>
          <MenuLink href={`/${locale}/register`}>{t("nav.register")}</MenuLink>
          <hr className="my-1 border-line" />
          <MenuLink href={`/${locale}/doctors`}>{t("nav.consult")}</MenuLink>
          <MenuLink href={`/${locale}/surgery`}>{t("nav.surgery")}</MenuLink>
          <MenuLink href={`/${locale}/stays`}>{t("nav.stays")}</MenuLink>
        </>
      )}
    </Dropdown>
  );
}
