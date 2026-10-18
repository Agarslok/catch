"use client";

import { useEffect, useRef } from "react";
import { useTavusCviOptional } from "@/components/catch/TavusCviProvider";

/** Presenta en Tavus el texto de Gemini (`conversation.echo`, no `conversation.respond`). */
export function TavusAiEcho({
  answer,
  echoId,
}: {
  answer: string;
  echoId: number;
}) {
  const tavus = useTavusCviOptional();
  const lastId = useRef(-1);

  useEffect(() => {
    const text = answer?.trim();
    if (!text || echoId < 0 || echoId === lastId.current) return;
    lastId.current = echoId;
    if (tavus?.tavusActive) {
      tavus.speakEcho(text, `gemini-${echoId}`);
    }
  }, [answer, echoId, tavus]);

  return null;
}
