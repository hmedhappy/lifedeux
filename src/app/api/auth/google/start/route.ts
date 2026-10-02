import { NextResponse, type NextRequest } from "next/server";
import { randomToken } from "@/lib/tokens";
import { GOOGLE_STATE_COOKIE, googleEnabled, googleRedirectUri } from "@/lib/google-auth";
import { isLocale } from "@/lib/i18n";

export const runtime = "nodejs";

/** Starts "Continuer avec Google": state kept in a short httpOnly cookie against CSRF. */
export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale");
  const lang = isLocale(locale) ? locale : "fr";
  const next = request.nextUrl.searchParams.get("next") ?? "";
  if (!googleEnabled()) return NextResponse.redirect(new URL(`/${lang}/login?error=google`, request.url));
  const state = randomToken(24);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, locale: lang, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return response;
}
