import "server-only";
import type { User } from "@prisma/client";
import { db } from "./db";
import { isDoctorRole } from "./roles";
import { chatState } from "./consultation-rules";

/** A consultation as seen by one of its two participants, or null for anyone else. */
export async function getConsultationForUser(id: string, user: User) {
  const c = await db.consultation.findUnique({
    where: { id },
    include: {
      slot: true,
      patient: true,
      doctor: { include: { user: true, specialty_: true } },
    },
  });
  if (!c) return null;
  if (c.patientId === user.id) return { consultation: c, as: "patient" as const, chat: chatState(c) };
  if (isDoctorRole(user.role) && c.doctor.userId === user.id) return { consultation: c, as: "doctor" as const, chat: chatState(c) };
  return null;
}

export type ChatMessage = {
  id: string;
  kind: "TEXT" | "IMAGE" | "PRESCRIPTION";
  mine: boolean;
  senderName: string;
  text: string | null;
  imageUrl: string | null;
  prescription: { id: string; number: string | null; pdfUrl: string } | null;
  createdAt: string;
};

export async function loadMessages(consultationId: string, viewerId: string, after?: Date): Promise<ChatMessage[]> {
  const rows = await db.message.findMany({
    where: { consultationId, ...(after ? { createdAt: { gt: after } } : {}) },
    include: { sender: { select: { firstName: true, lastName: true, role: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const prescriptionIds = rows.map((r) => r.prescriptionId).filter((v): v is string => !!v);
  const prescriptions = prescriptionIds.length
    ? await db.prescription.findMany({ where: { id: { in: prescriptionIds } }, select: { id: true, number: true } })
    : [];
  return rows.map((m) => {
    const p = prescriptions.find((x) => x.id === m.prescriptionId);
    return {
      id: m.id,
      kind: m.kind,
      mine: m.senderId === viewerId,
      senderName: isDoctorRole(m.sender.role) ? `Dr ${m.sender.lastName}` : m.sender.firstName,
      text: m.text,
      imageUrl: m.imageId ? `/api/consultations/${consultationId}/images/${m.imageId}` : null,
      prescription: p ? { id: p.id, number: p.number, pdfUrl: `/api/prescriptions/${p.id}/pdf` } : null,
      createdAt: m.createdAt.toISOString(),
    };
  });
}
