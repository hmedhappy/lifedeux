import { NextResponse, type NextRequest } from "next/server";
import { createSession, homeFor } from "@/lib/auth";
import { db } from "@/lib/db";
import { GOOGLE_STATE_COOKIE, exchangeGoogleCode, googleEnabled } from "@/lib/google-auth";
import { isLatinName } from "@/lib/latin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  let saved: { state: string; locale: string; next: string } | null = null;
  try {
    saved = JSON.parse(request.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? "null");
  } catch {
    saved = null;
  }
  const locale = saved?.locale ?? "fr";
  const fail = () => NextResponse.redirect(new URL(`/${locale}/login?error=google`, request.url));
  const code = request.nextUrl.searchParams.get("code");
  if (!googleEnabled() || !saved || !code || request.nextUrl.searchParams.get("state") !== saved.state) return fail();

  const profile = await exchangeGoogleCode(code);
  if (!profile || !profile.emailVerified) return fail();

  let user = await db.user.findFirst({ where: { OR: [{ googleSub: profile.sub }, { email: profile.email }] } });
  if (user && !user.active) return fail();
  const latin = isLatinName(profile.givenName) && isLatinName(profile.familyName);
  if (!user) {
    // Names must be in Latin letters (they appear on prescriptions); otherwise the patient completes them.
    user = await db.user.create({
      data: {
        email: profile.email,
        googleSub: profile.sub,
        firstName: latin ? profile.givenName : "",
        lastName: latin ? profile.familyName : "",
        role: "PATIENT",
        locale,
        consentAt: new Date(),
      },
    });
  } else if (!user.googleSub) {
    user = await db.user.update({ where: { id: user.id }, data: { googleSub: profile.sub } });
  }
  await createSession(user);

  const next = saved.next.startsWith(`/${locale}/`) && !saved.next.startsWith("//") ? saved.next : null;
  const target = !user.firstName || !user.lastName ? `/${locale}/account/profile?complete=1` : (next ?? `/${locale}${homeFor(user.role)}`);
  const response = NextResponse.redirect(new URL(target, request.url));
  response.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
  return response;
}
