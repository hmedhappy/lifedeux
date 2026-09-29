import type { Role } from "@prisma/client";

/** Doctors and super-doctors share the doctor area; super-doctors also get referrals. */
export const DOCTOR_ROLES: Role[] = ["DOCTOR", "SUPER_DOCTOR"];

export function isDoctorRole(role: Role): boolean {
  return role === "DOCTOR" || role === "SUPER_DOCTOR";
}
