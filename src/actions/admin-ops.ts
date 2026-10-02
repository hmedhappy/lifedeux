"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { REFUND_REAUTH_THRESHOLD, audit } from "@/lib/audit";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { doctorBalances } from "@/lib/bookings";
import { db } from "@/lib/db";
import { toLocale } from "@/lib/i18n";
import { refundPayment } from "@/lib/payment-ops";

async function currentAdmin() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" ? user : null;
}

export async function resolveAlertAction(localeRaw: string, id: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const admin = await currentAdmin();
  if (!admin) redirect(`/${locale}/login`);
  await db.alert.updateMany({ where: { id, resolvedAt: null }, data: { resolvedAt: new Date() } });
  revalidatePath(`/${locale}/admin`);
}

/** Applies (or drops) the consultation price a doctor asked for. */
export async function reviewPriceAction(localeRaw: string, doctorId: string, approve: boolean): Promise<void> {
  const locale = toLocale(localeRaw);
  const admin = await currentAdmin();
  if (!admin) redirect(`/${locale}/login`);
  const doctor = await db.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor?.pendingConsultationPrice) return;
  await db.$transaction([
    db.doctor.update({
      where: { id: doctorId },
      data: approve ? { consultationPrice: doctor.pendingConsultationPrice, pendingConsultationPrice: null } : { pendingConsultationPrice: null },
    }),
    db.alert.updateMany({ where: { doctorId, kind: "priceChange", resolvedAt: null }, data: { resolvedAt: new Date() } }),
  ]);
  await audit(admin.id, approve ? "price.approve" : "price.reject", doctorId, { from: doctor.consultationPrice, to: doctor.pendingConsultationPrice });
  revalidatePath(`/${locale}/admin`, "layout");
}

/** A referred doctor becomes visible once the admin has checked their licence number (and stamp). */
export async function verifyDoctorAction(localeRaw: string, doctorId: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const admin = await currentAdmin();
  if (!admin) redirect(`/${locale}/login`);
  const doctor = await db.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor || doctor.verifiedAt) return;
  await db.doctor.update({
    where: { id: doctorId },
    data: {
      verifiedAt: new Date(),
      ...(doctor.pendingStampImageId ? { stampImageId: doctor.pendingStampImageId, pendingStampImageId: null } : {}),
    },
  });
  await db.alert.updateMany({ where: { doctorId, kind: "stampToReview", resolvedAt: null }, data: { resolvedAt: new Date() } });
  await audit(admin.id, "doctor.verify", doctorId, { licenseNumber: doctor.licenseNumber });
  revalidatePath(`/${locale}/admin`, "layout");
}

/**
 * Full refund of a payment (docs/RELOOKING.md §4: no partial refunds). Above 500 the
 * admin types their password again.
 */
export async function refundPaymentAction(localeRaw: string, paymentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const admin = await currentAdmin();
  if (!admin) return fail("errors.forbidden");
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "SUCCEEDED") return fail("errors.invalid");
  if (payment.amount > REFUND_REAUTH_THRESHOLD * 100) {
    const user = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    if (!(await verifyPassword(String(formData.get("password") ?? ""), user.passwordHash))) return fail("errors.reauthFailed");
  }
  if (!(await refundPayment(payment))) return fail("errors.refundFailed");
  await audit(admin.id, "payment.refund", payment.id, { amount: payment.amount, currency: payment.currency, bookingId: payment.bookingId, consultationId: payment.consultationId });
  revalidatePath(`/${locale}/admin`, "layout");
  return ok(payment.provider === "stripe" ? "admin.refunded" : "admin.refundRecorded");
}

/** The admin cancels a fraudulent or wrong prescription (after contacting the doctor). */
export async function adminRevokePrescriptionAction(localeRaw: string, id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const admin = await currentAdmin();
  if (!admin) return fail("errors.forbidden");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!reason) return fail("errors.reasonRequired");
  const p = await db.prescription.findUnique({ where: { id } });
  if (!p || p.status !== "ISSUED") return fail("errors.invalid");
  await db.$transaction([
    db.prescription.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date(), revokeReason: reason } }),
    db.message.create({ data: { consultationId: p.consultationId, senderId: admin.id, kind: "SYSTEM", text: `rxRevoked:${p.number}` } }),
  ]);
  await audit(admin.id, "prescription.revoke", id, { number: p.number, reason });
  revalidatePath(`/${locale}/admin/consultations/${p.consultationId}`);
  return ok("admin.rxRevoked");
}

/** Monthly batch: one payout per doctor for their whole balance, by cash or transfer. */
export async function recordMonthlyBatchAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const admin = await currentAdmin();
  if (!admin) return fail("errors.forbidden");
  const method = formData.get("method") === "TRANSFER" ? "TRANSFER" : "CASH";
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  const balances = await doctorBalances();
  const due = [...balances.entries()].filter(([, b]) => b.earned - b.paid > 0);
  if (due.length === 0) return fail("errors.nothingDue");
  const paidAt = new Date();
  await db.doctorPayout.createMany({
    data: due.map(([doctorId, b]) => ({ doctorId, amount: b.earned - b.paid, paidAt, method, note, recordedById: admin.id })),
  });
  await audit(admin.id, "payout.batch", null, { method, count: due.length, total: due.reduce((s, [, b]) => s + b.earned - b.paid, 0) });
  revalidatePath(`/${locale}/admin/payouts`);
  return ok("admin.batchRecorded", { vars: { n: due.length } });
}
