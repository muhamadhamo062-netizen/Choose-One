"use client";

import { useMemo, useState } from "react";
import { UnlockModal } from "@/components/paywall/UnlockModal";
import { UnlockModalContext, type UnlockSource } from "@/hooks/useUnlockModal";

interface UnlockModalProviderProps {
  children: React.ReactNode;
}

export function UnlockModalProvider({ children }: UnlockModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [source, setSource] = useState<UnlockSource>("scanner");

  const value = useMemo(
    () => ({
      isOpen,
      source,
      openModal: (nextSource: UnlockSource) => {
        setSource(nextSource);
        setIsOpen(true);
      },
      closeModal: () => setIsOpen(false)
    }),
    [isOpen, source]
  );

  return (
    <UnlockModalContext.Provider value={value}>
      {children}
      <UnlockModal isOpen={isOpen} source={source} onClose={() => setIsOpen(false)} />
    </UnlockModalContext.Provider>
  );
}
