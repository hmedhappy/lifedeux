import { chromium, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient(); const OUT = process.env.OUT!; const B = "http://localhost:3000";
const c = await db.consultation.findFirstOrThrow({ where: { reference: "LC-DEMO03" } });
const amira = await db.doctor.findFirstOrThrow({ where: { user: { email: "dr.amira@demo.lifedeux.com" } } });
const b = await chromium.launch({ executablePath: process.env.PW });
async function login(p: Page, email: string, pw = "Demo12345!") {
  await p.goto(`${B}/fr/login`); await p.locator("details:has([data-testid=password-login]) > summary").click();
  const f = p.locator("form:has([data-testid=password-login])");
  await f.locator('input[name="email"]').fill(email); await f.locator('input[name="password"]').fill(pw);
  await p.getByTestId("password-login").click(); await p.waitForURL((u) => !u.pathname.includes("/login"));
}
const roles: [string, string | null, string[]][] = [
  ["visitor", null, ["/", "/doctors", `/doctors/${amira.id}`, "/surgery", "/stays", "/login", "/register"]],
  ["patient", "sara@demo.lifedeux.com", ["/account", `/account/consultations/${c.id}`, "/account/messages", "/account/documents", "/account/profile", `/doctors/${amira.id}`]],
  ["doctor", "dr.amira@demo.lifedeux.com", ["/doctor", "/doctor/consultations", `/doctor/consultations/${c.id}`, "/doctor/slots", "/doctor/patients", "/doctor/payouts", "/doctor/profile", "/doctor/prescription", `/doctors/${amira.id}`]],
  ["admin", "you@example.com", ["/admin", "/admin/bookings", "/admin/consultations", "/admin/doctors", "/admin/settings"]],
];
for (const [role, email, paths] of roles) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
  if (email) await login(p, email, role === "admin" ? process.env.ADMIN_PW : undefined).catch((e) => console.log("login fail", role, String(e).slice(0, 80)));
  for (const loc of ["fr", "ar"]) for (const [i, path] of paths.entries()) {
    await p.goto(`${B}/${loc}${path === "/" ? "" : path}`, { waitUntil: "networkidle" }).catch(() => {});
    await p.waitForTimeout(300);
    const name = `${role}-${String(i).padStart(2, "0")}-${loc}`;
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) console.log("H-OVERFLOW", name, path, overflow + "px");
  }
  await ctx.close();
}
await b.close(); await db.$disconnect();
