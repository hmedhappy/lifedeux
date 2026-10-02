"use client";

import { createContext, useContext } from "react";

/** Lets the chat open the doctor's side panels (patient file, prescription) from its own icons. */
export type ConsultPanels = {
  openPatient: () => void;
  toggleRx?: () => void;
  rxOpen?: boolean;
};

export const ConsultPanelsContext = createContext<ConsultPanels | null>(null);

export function useConsultPanels() {
  return useContext(ConsultPanelsContext);
}
