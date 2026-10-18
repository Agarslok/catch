"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useTavusCviSession } from "@/hooks/useTavusCviSession";

type TavusContextValue = ReturnType<typeof useTavusCviSession> & {
  meetingId?: string;
  presenterToken?: string;
  canStartTavus: boolean;
};

const TavusCviContext = createContext<TavusContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  meetingId?: string;
  presenterToken?: string;
  canStartTavus: boolean;
};

export function TavusCviProvider({
  children,
  meetingId,
  presenterToken,
  canStartTavus,
}: ProviderProps) {
  const session = useTavusCviSession(canStartTavus);
  const value: TavusContextValue = {
    ...session,
    meetingId,
    presenterToken,
    canStartTavus,
  };
  return <TavusCviContext.Provider value={value}>{children}</TavusCviContext.Provider>;
}

export function useTavusCvi() {
  const ctx = useContext(TavusCviContext);
  if (!ctx) {
    throw new Error("useTavusCvi must be used within TavusCviProvider");
  }
  return ctx;
}

export function useTavusCviOptional() {
  return useContext(TavusCviContext);
}
