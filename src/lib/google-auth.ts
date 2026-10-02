import "server-only";
import { appUrl } from "./settings";

/** Google sign-in is offered only when both variables are set. */
export function googleEnabled(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export const GOOGLE_STATE_COOKIE = "ld_google_state";
export const googleRedirectUri = () => `${appUrl()}/api/auth/google/callback`;

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; givenName: string; familyName: string };

export async function exchangeGoogleCode(code: string): Promise<GoogleProfile | null> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return null;
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return null;
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!infoRes.ok) return null;
  const info = (await infoRes.json()) as { sub?: string; email?: string; email_verified?: boolean; given_name?: string; family_name?: string };
  if (!info.sub || !info.email) return null;
  return {
    sub: info.sub,
    email: info.email.toLowerCase(),
    emailVerified: !!info.email_verified,
    givenName: info.given_name ?? "",
    familyName: info.family_name ?? "",
  };
}
