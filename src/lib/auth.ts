import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session-token";
import type { Locale } from "./i18n";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export async function createSession(user: Pick<User, "id" | "role">): Promise<void> {
  const token = await signSession({ sub: user.id, role: user.role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Current user, re-read from the database so deactivated accounts lose access immediately. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user || !user.active) return null;
  return user;
}

export function homeFor(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "DOCTOR":
      return "/doctor";
    case "AGENT":
      return "/scan";
    default:
      return "/account";
  }
}

/** Redirects to login (or to the user's own space) when the role is not allowed. */
export async function requireRole(locale: Locale, roles: Role[], next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const query = next ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/${locale}/login${query}`);
  }
  if (!roles.includes(user.role)) redirect(`/${locale}${homeFor(user.role)}`);
  return user;
}

export async function requireDoctor(locale: Locale) {
  const user = await requireRole(locale, ["DOCTOR"]);
  const doctor = await db.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) redirect(`/${locale}`);
  return { user, doctor };
}
