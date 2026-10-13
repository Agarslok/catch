"use client";

import { useCallback, useEffect, useRef } from "react";

/** Intenta reproducir con audio; si el navegador lo bloquea, cae a muted. */
export function useAvatarVideoPlayback(active: boolean) {
  const ref = useRef<HTMLVideoElement>(null);

  const play = useCallback(async () => {
    const v = ref.current;
    if (!v) return;
    v.loop = true;
    v.playsInline = true;
    try {
      v.muted = false;
      await v.play();
    } catch {
      try {
        v.muted = true;
        await v.play();
      } catch {
        /* autoplay bloqueado hasta interacción del usuario */
      }
    }
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) void play();
    else v.pause();
  }, [active, play]);

  return { ref, play };
}
