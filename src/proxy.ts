import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

const LOCALE_COOKIE = "ld_locale";

/** First path segment after the locale → roles allowed. Pages re-check with requireRole. */
const PROTECTED: Record<string, Role[]> = {
  admin: ["ADMIN"],
  doctor: ["DOCTOR"],
  account: ["PATIENT"],
  scan: ["AGENT", "ADMIN"],
};

const HOME: Record<Role, string> = {
  ADMIN: "admin",
  DOCTOR: "doctor",
  AGENT: "scan",
  PATIENT: "account",
};

function preferredLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  const header = request.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const code = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  if (!isLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const locale = first;
  const area = segments[1];
  const allowed = area ? PROTECTED[area] : undefined;
  if (allowed) {
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    if (!allowed.includes(session.role)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/${HOME[session.role]}`;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const response = NextResponse.next();
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};

