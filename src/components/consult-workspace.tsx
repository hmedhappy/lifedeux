"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { FileText, UserRound, X } from "lucide-react";
import { ConsultPanelsContext } from "./consult-context";
import { useI18n } from "./i18n-provider";

const LARGE = "(min-width: 1024px)";

/**
 * Doctor's consultation screen. The chat takes the room (full screen on phones); the patient file
 * and the prescription open from icons in the chat, as panels sliding in from the side.
 * Large screens keep the prescription as a column next to the chat, folded from the same icon.
 */
export function ConsultWorkspace({ chat, prescription, patient }: { chat: React.ReactNode; prescription: React.ReactNode | null; patient: React.ReactNode }) {
  const { t } = useI18n();
  const [patientOpen, setPatientOpen] = useState(false);
  // Phones: the prescription panel over the chat. Large screens: the column, open by default.
  const [rxSheet, setRxSheet] = useState(false);
  const [rxColumn, setRxColumn] = useState(true);

  const toggleRx = useCallback(() => {
    if (window.matchMedia(LARGE).matches) setRxColumn((v) => !v);
    else setRxSheet((v) => !v);
  }, []);

  useEffect(() => {
    if (!patientOpen && !rxSheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPatientOpen(false);
      setRxSheet(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [patientOpen, rxSheet]);

  const panels = useMemo(
    () => ({ openPatient: () => setPatientOpen(true), toggleRx: prescription ? toggleRx : undefined, rxOpen: rxSheet || rxColumn }),
    [prescription, toggleRx, rxSheet, rxColumn],
  );

  return (
    <ConsultPanelsContext.Provider value={panels}>
      <div className={clsx("lg:grid lg:items-start lg:gap-5", prescription && rxColumn ? "lg:grid-cols-[minmax(0,1fr)_400px]" : "lg:grid-cols-1")}>
        <div className="min-w-0">{chat}</div>
        {prescription && (
          // One editor for both layouts, so a prescription in progress survives opening and closing.
          <div
            className={clsx(
              "fixed inset-0 z-[60] flex flex-col bg-white transition-[transform,visibility] duration-300 ease-[var(--ease-standard)]",
              rxSheet ? "visible translate-x-0" : "invisible translate-x-full rtl:-translate-x-full",
              "lg:visible lg:static lg:z-auto lg:translate-x-0 lg:bg-transparent lg:transition-none rtl:lg:translate-x-0",
              !rxColumn && "lg:hidden",
            )}
            role="region"
            aria-label={t("workspace.prescription")}
            data-testid="rx-panel"
          >
            <PanelHeader
              title={t("workspace.prescription")}
              icon={FileText}
              onClose={() => setRxSheet(false)}
              closeLabel={t("common.close")}
              className="lg:hidden"
            />
            <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:overflow-visible lg:p-0">{prescription}</div>
          </div>
        )}
      </div>

      {/* Patient file: a panel from the side, on every screen size. */}
      <div
        className={clsx("fixed inset-0 z-[60] bg-ink/30 transition-opacity duration-300", patientOpen ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={() => setPatientOpen(false)}
        aria-hidden
      />
      <div
        className={clsx(
          "fixed inset-y-0 end-0 z-[61] flex w-full flex-col bg-canvas shadow-sheet transition-[transform,visibility] duration-300 ease-[var(--ease-standard)] sm:max-w-md",
          patientOpen ? "visible translate-x-0" : "invisible translate-x-full rtl:-translate-x-full",
        )}
        role="dialog"
        aria-modal={patientOpen}
        aria-label={t("workspace.patient")}
        data-testid="patient-sheet"
      >
        <PanelHeader title={t("workspace.patient")} icon={UserRound} onClose={() => setPatientOpen(false)} closeLabel={t("common.close")} />
        <div className="flex-1 overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{patient}</div>
      </div>
    </ConsultPanelsContext.Provider>
  );
}

function PanelHeader({
  title,
  icon: Icon,
  onClose,
  closeLabel,
  className,
}: {
  title: string;
  icon: typeof FileText;
  onClose: () => void;
  closeLabel: string;
  className?: string;
}) {
  return (
    <header
      className={clsx("flex items-center justify-between gap-2 border-b border-line bg-white px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]", className)}
    >
      <p className="flex items-center gap-2 font-semibold text-ink">
        <Icon className="h-5 w-5 text-brand" aria-hidden />
        {title}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-surface"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
    </header>
  );
}
