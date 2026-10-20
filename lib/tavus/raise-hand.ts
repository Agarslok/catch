export const TAVUS_RAISE_HAND_ECHO =
  "Te escucho. Cuando quieras, cuéntame tu pregunta con calma.";

export type TavusRaiseHandSession = {
  tavusActive: boolean;
  interruptSpeech: () => boolean;
  speakEcho: (text: string, echoId?: string) => boolean;
};

export type TavusRaiseHandResult = {
  interrupted: boolean;
  echoSent: boolean;
  tavusActive: boolean;
};

/** Corta lo que Frida está diciendo y pide turno de palabra (sin colgar la sesión). */
export function performTavusRaiseHand(session: TavusRaiseHandSession): TavusRaiseHandResult {
  const interrupted = session.interruptSpeech();
  if (!session.tavusActive) {
    return { interrupted, echoSent: false, tavusActive: false };
  }
  const echoSent = session.speakEcho(TAVUS_RAISE_HAND_ECHO, `raise-hand-${Date.now()}`);
  return { interrupted, echoSent, tavusActive: true };
}
