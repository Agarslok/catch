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
  /** No asocia el avatar a una reunión ni publica su sesión en Supabase. */
  detached?: boolean;
};

export function TavusCviProvider({
  children,
  meetingId,
  presenterToken,
  canStartTavus,
  detached = false,
}: ProviderProps) {
  const session = useTavusCviSession(canStartTavus);
  const value: TavusContextValue = {
    ...session,
    meetingId: detached ? undefined : meetingId,
    presenterToken: detached ? undefined : presenterToken,
    canStartTavus,
    startSession: (opts) =>
      session.startSession({
        ...opts,
        detached,
        meetingId: detached ? undefined : (opts?.meetingId ?? meetingId),
        presenterToken: detached ? undefined : (opts?.presenterToken ?? presenterToken),
      }),
    endSession: (opts) =>
      session.endSession({
        ...opts,
        detached,
        meetingId: detached ? undefined : (opts?.meetingId ?? meetingId),
        presenterToken: detached ? undefined : (opts?.presenterToken ?? presenterToken),
      }),
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
