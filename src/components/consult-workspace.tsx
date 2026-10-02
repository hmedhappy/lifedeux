"use client";

import { useState } from "react";
import clsx from "clsx";
import { FileText, MessageCircle, PanelRightClose, PanelRightOpen, UserRound } from "lucide-react";
import { useI18n } from "./i18n-provider";

type Tab = "chat" | "rx" | "patient";

/**
 * Doctor's consultation screen. Phones: tabs Chat · Ordonnance · Patient.
 * Large screens: patient summary on top, then chat | prescription (which folds away).
 */
export function ConsultWorkspace({
  chat,
  prescription,
  patient,
}: {
  chat: React.ReactNode;
  prescription: React.ReactNode | null;
  patient: React.ReactNode;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("chat");
  const [rxOpen, setRxOpen] = useState(true);
  const tabs: { id: Tab; label: string; icon: typeof MessageCircle }[] = [
    { id: "chat", label: t("workspace.chat"), icon: MessageCircle },
    ...(prescription ? [{ id: "rx" as const, label: t("workspace.prescription"), icon: FileText }] : []),
    { id: "patient", label: t("workspace.patient"), icon: UserRound },
  ];

  return (
    <div>
      <div className="mb-3 grid grid-flow-col gap-1 rounded-2xl bg-surface p-1 lg:hidden" role="tablist" data-testid="workspace-tabs">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={clsx(
              "flex min-h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition",
              tab === id ? "bg-white text-ink shadow-card" : "text-muted",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <div
        className={clsx(
          "lg:grid lg:items-start lg:gap-5",
          prescription && rxOpen
            ? "lg:grid-cols-[minmax(0,1fr)_380px]"
            : "lg:grid-cols-[minmax(0,1fr)_auto]",
        )}
      >
        {/* Large screens: a compact row above the chat. */}
        <div className={clsx(tab === "patient" ? "block" : "hidden", "lg:col-span-full lg:mb-1 lg:block")}>{patient}</div>
        <div className={clsx(tab === "chat" ? "block" : "hidden", "min-w-0 lg:block")}>{chat}</div>
        {prescription && (
          <div className={clsx(tab === "rx" ? "block" : "hidden", "lg:block")}>
            <button
              type="button"
              onClick={() => setRxOpen((v) => !v)}
              className="mb-2 hidden min-h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-ink-soft hover:bg-surface lg:inline-flex"
              aria-expanded={rxOpen}
            >
              {rxOpen ? <PanelRightClose className="h-4 w-4 rtl:-scale-x-100" aria-hidden /> : <PanelRightOpen className="h-4 w-4 rtl:-scale-x-100" aria-hidden />}
              {rxOpen ? t("workspace.fold") : t("workspace.prescription")}
            </button>
            <div className={clsx(!rxOpen && "lg:hidden")}>{prescription}</div>
          </div>
        )}
      </div>
    </div>
  );
}
