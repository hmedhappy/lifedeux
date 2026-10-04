import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getT, toLocale } from "./i18n";
import { db } from "./db";
import { appUrl } from "./settings";
import { sendWhatsApp, whatsappEnabled, whatsappNumber } from "./whatsapp";

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

/** MAIL_ONLY_TO (a regex) limits real sending, e.g. e2e runs on a real mailbox; other recipients are only logged. */
function deliverable(to: string): boolean {
  const only = process.env.MAIL_ONLY_TO;
  return !only || new RegExp(only, "i").test(to);
}

export async function sendMail(mail: Mail): Promise<void> {
  const t = getTransporter();
  if (!t || !deliverable(mail.to)) {
    console.info(`[mail] SMTP not configured — would send to ${mail.to}: ${mail.subject}`);
    return;
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM ?? "Medelys <no-reply@lifedeux.com>", ...mail });
  } catch (error) {
    // A mail failure must never break the booking flow.
    console.error("[mail] failed to send", error);
  }
}

/** Medelys email frame: logo as a hosted PNG (mail clients block SVG), brand button, calm footer. */
type Extra = { text: string; label: string; href: string };

function layout(title: string, body: string, cta?: { label: string; href: string }, centered = false, extra?: Extra): string {
  const align = centered ? "center" : "left";
  const button = cta
    ? `<p style="margin:28px 0;text-align:${align}"><a href="${cta.href}" style="display:inline-block;background:#014D7D;color:#fff;padding:${centered ? "14px 36px" : "12px 22px"};border-radius:10px;text-decoration:none;font-weight:600">${cta.label}</a></p>`
    : "";
  const logo = centered
    ? `<img src="${appUrl()}/brand/logo-horizontal.png" alt="Medelys" width="160" height="36" style="display:block;margin:0 auto;border:0;height:36px;width:160px">`
    : `<img src="${appUrl()}/brand/logo-horizontal.png" alt="Medelys" width="160" height="36" style="display:block;border:0;height:36px;width:160px">`;
  return `<div style="font-family:Poppins,Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#12304F;text-align:${align}">
  <p style="margin:0 0 24px">${logo}</p>
  <h2 style="font-size:${centered ? "22px" : "18px"}">${title}</h2>
  <p style="line-height:1.6">${body}</p>${button}${
    extra
      ? `<div style="margin:8px 0 24px;padding:16px;border-radius:12px;background:#F4F7F8;text-align:${align}"><p style="margin:0 0 12px;line-height:1.6">${extra.text}</p><a href="${extra.href}" style="display:inline-block;border:1px solid #014D7D;color:#014D7D;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">${extra.label}</a></div>`
      : ""
  }
  <p style="color:#5B6B7A;font-size:12px;border-top:1px solid #DCE4E8;padding-top:12px">Medelys</p></div>`;
}

type Recipient = { id?: string; email: string; firstName: string; locale: string; phone?: string | null };

/** Account emails stay email-only; everything else also goes to WhatsApp when it is set up. */
const EMAIL_ONLY = new Set(["invite", "doctorInvite", "reset", "loginCode", "confirmBooking", "confirmOnlineBooking", "favoriteSaved"]);
/** Welcome emails use the centred frame. */
const CENTERED = new Set(["doctorInvite", "confirmBooking", "confirmOnlineBooking", "favoriteSaved"]);

const strip = (html: string) => html.replace(/<[^>]+>/g, "");

/** Subjects stay neutral on purpose: no medical wording in inboxes. */
export async function sendTemplate(
  to: Recipient,
  template:
    | "invite"
    | "doctorInvite"
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
    | "consultCancelled"
    | "newInPerson"
    | "confirmBooking"
    | "confirmOnlineBooking"
    | "favoriteSaved"
    | "inPersonRequested"
    | "inPersonConfirmed"
    | "inPersonReminder"
    | "inPersonCancelled"
    | "rescheduleRequested"
    | "rescheduleAnswered"
    | "prescription"
    | "reminderDay"
    | "reminderSoon"
    | "doctorNudge"
    | "trackingStep"
    | "agentPlanning"
    | "adminAlert",
  vars: Record<string, string>,
  path?: string,
  /** Path of the "create my password" page, for accounts made by email code. */
  passwordPath?: string | null,
): Promise<void> {
  const locale = toLocale(to.locale);
  const t = getT(locale);
  const data = { name: to.firstName, ...vars };
  const href = path ? `${appUrl()}/${locale}${path}` : undefined;
  const body = t(`email.${template}.body`, data);
  await sendMail({
    to: to.email,
    subject: t(`email.${template}.subject`, data),
    html: layout(t(`email.${template}.title`, data), body, href ? { label: t(`email.${template}.cta`, data), href } : undefined,
      CENTERED.has(template),
      passwordPath ? { text: t("email.accountReady.text"), label: t("email.accountReady.cta"), href: `${appUrl()}/${locale}${passwordPath}` } : undefined,
    ),
  });
  const logs = [{ userId: to.id ?? null, channel: "email", template, target: to.email, status: process.env.SMTP_HOST && deliverable(to.email) ? "sent" : "logged" }];
  const phone = EMAIL_ONLY.has(template) || !whatsappEnabled() ? null : whatsappNumber(to.phone);
  if (phone) {
    const ok = await sendWhatsApp(phone, `${strip(body)}${href ? ` ${href}` : ""}`, locale);
    logs.push({ userId: to.id ?? null, channel: "whatsapp", template, target: phone, status: ok ? "sent" : "failed" });
  }
  await db.notificationLog.createMany({ data: logs }).catch(() => undefined);
}
