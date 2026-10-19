"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VOLUME_KEY = "catch-avatar-volume";

function readStoredVolume(): number {
  try {
    const n = parseFloat(localStorage.getItem(VOLUME_KEY) ?? "1");
    if (!Number.isFinite(n)) return 1;
    return Math.min(1, Math.max(0, n));
  } catch {
    return 1;
  }
}

/** Reproduce en bucle; el audio requiere desmutear (política de autoplay). */
export function useAvatarVideoPlayback(active: boolean, syncPaused = false) {
  const ref = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(readStoredVolume);
  const [muted, setMuted] = useState(true);

  const play = useCallback(async (preferUnmuted = false) => {
    const v = ref.current;
    if (!v) return;
    v.loop = true;
    v.playsInline = true;
    v.volume = volume;
    if (preferUnmuted) v.muted = false;
    try {
      await v.play();
      if (preferUnmuted) setMuted(false);
    } catch {
      try {
        v.muted = true;
        setMuted(true);
        await v.play();
      } catch {
        /* autoplay bloqueado hasta interacción del usuario */
      }
    }
  }, [volume]);

  const toggleMute = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (v.muted) void play(true);
    else {
      v.muted = true;
      setMuted(true);
    }
  }, [play]);

  const onVolumeChange = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next));
    setVolume(clamped);
    try {
      localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      /* ignore */
    }
    const v = ref.current;
    if (v) v.volume = clamped;
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!active || syncPaused) {
      v.pause();
      return;
    }
    void play();
  }, [active, syncPaused, play]);

  return { ref, play, muted, volume, toggleMute, onVolumeChange };
}
