"use client";

import { usePathname } from "next/navigation";

/** Chat and payment are "focus" screens: no footer, nothing to pull the patient away. */
const FOCUS = [/\/account\/consultations\/[^/]+$/, /\/payment\//, /\/account\/messages\/[^/]+$/];

export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (FOCUS.some((re) => re.test(pathname))) return null;
  return <>{children}</>;
}
