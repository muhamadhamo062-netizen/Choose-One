import { createContext, useContext } from "react";

export type UnlockSource = "scanner" | "dashboard";

export interface UnlockModalState {
  isOpen: boolean;
  source: UnlockSource;
}

export interface UnlockModalController {
  isOpen: boolean;
  source: UnlockSource;
  openModal: (source: UnlockSource) => void;
  closeModal: () => void;
}

export const UnlockModalContext = createContext<UnlockModalController | null>(null);

export function useUnlockModal(): UnlockModalController {
  const ctx = useContext(UnlockModalContext);
  if (!ctx) {
    throw new Error("useUnlockModal must be used inside UnlockModalProvider");
  }
  return ctx;
}
