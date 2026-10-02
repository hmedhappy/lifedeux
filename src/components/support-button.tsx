"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { FooterGate } from "./footer-gate";

/** Discreet WhatsApp help, above the tab bar; hidden on focus screens (chat, payment). */
export function SupportButton({ phone }: { phone: string }) {
  const { t } = useI18n();
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return (
    <FooterGate>
      <a
        href={`https://wa.me/${digits}?text=${encodeURIComponent(t("support.prefill"))}`}
        target="_blank"
        rel="noopener"
        aria-label={t("support.label")}
        title={t("support.label")}
        className="no-print fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] end-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white text-[#128C7E] shadow-float transition hover:scale-105 md:bottom-6"
        data-testid="support-whatsapp"
      >
        <MessageCircleQuestion className="h-6 w-6" aria-hidden />
      </a>
    </FooterGate>
  );
}
