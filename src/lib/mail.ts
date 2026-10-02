import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getT, toLocale } from "./i18n";
import { appUrl } from "./settings";

type Mail = { to: string; subject: string; html: string };

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export async function sendMail(mail: Mail): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.info(`[mail] SMTP not configured — would send to ${mail.to}: ${mail.subject}`);
    return;
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM ?? "LifeDeux <no-reply@lifedeux.com>", ...mail });
  } catch (error) {
    // A mail failure must never break the booking flow.
    console.error("[mail] failed to send", error);
  }
}

function layout(title: string, body: string, cta?: { label: string; href: string }): string {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.href}" style="background:#0F766E;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">${cta.label}</a></p>`
    : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#222">
  <h1 style="font-size:20px;color:#0F766E">LifeDeux</h1>
  <h2 style="font-size:18px">${title}</h2>
  <p style="line-height:1.6">${body}</p>${button}
  <p style="color:#717171;font-size:12px">LifeDeux</p></div>`;
}

type Recipient = { email: string; firstName: string; locale: string };

/** Subjects stay neutral on purpose: no medical wording in inboxes. */
export async function sendTemplate(
  to: Recipient,
  template:
    | "invite"
    | "reset"
    | "loginCode"
    | "requestReceived"
    | "newRequest"
    | "confirmed"
    | "refused"
    | "paid"
    | "expired"
    | "consultConfirmed"
    | "consultPaid"
    | "prescription",
  vars: Record<string, string>,
  path?: string,
): Promise<void> {
  const locale = toLocale(to.locale);
  const t = getT(locale);
  const data = { name: to.firstName, ...vars };
  const href = path ? `${appUrl()}/${locale}${path}` : undefined;
  await sendMail({
    to: to.email,
    subject: t(`email.${template}.subject`, data),
    html: layout(
      t(`email.${template}.title`, data),
      t(`email.${template}.body`, data),
      href ? { label: t(`email.${template}.cta`, data), href } : undefined,
    ),
  });
}
