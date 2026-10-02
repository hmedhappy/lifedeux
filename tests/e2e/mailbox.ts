import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

/** Real Gmail mailbox used by email.spec.ts; tests skip when it is not configured (.env.e2e.local). */
const USER = process.env.E2E_GMAIL_USER;
const PASSWORD = process.env.E2E_GMAIL_APP_PASSWORD;
export const mailboxConfigured = Boolean(USER && PASSWORD);

/** A fresh plus address of the mailbox: Gmail delivers name+tag@gmail.com to name@gmail.com. */
export function mailboxAddress(tag: string): string {
  const [name, domain] = USER!.split("@");
  return `${name}+${tag}.${Date.now()}@${domain}`;
}

export type ReceivedMail = { subject: string; html: string; text: string };

/**
 * Waits for the newest message sent to `to`, reads it, then moves it to the bin so test mail does not pile up.
 * Searches "All Mail": a message sent to yourself may skip the inbox.
 */
export async function waitForMail(to: string, timeout = 90_000): Promise<ReceivedMail> {
  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user: USER!, pass: PASSWORD! }, logger: false });
  await client.connect();
  try {
    const boxes = await client.list();
    const all = boxes.find((b) => b.specialUse === "\\All")?.path ?? "INBOX";
    const trash = boxes.find((b) => b.specialUse === "\\Trash")?.path;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const lock = await client.getMailboxLock(all);
      try {
        const uids = (await client.search({ to }, { uid: true })) || [];
        if (uids.length) {
          const uid = uids[uids.length - 1];
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (msg && msg.source) {
            const parsed = await simpleParser(msg.source);
            if (trash) await client.messageMove(String(uid), trash, { uid: true });
            return { subject: parsed.subject ?? "", html: parsed.html || "", text: parsed.text ?? "" };
          }
        }
      } finally {
        lock.release();
      }
      await new Promise((r) => setTimeout(r, 3_000));
    }
    throw new Error(`No email for ${to} after ${timeout / 1000}s`);
  } finally {
    await client.logout().catch(() => undefined);
  }
}
