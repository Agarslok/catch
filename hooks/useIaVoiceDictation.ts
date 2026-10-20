"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useIaVoiceDictation(onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListenRef = useRef(false);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
    return () => {
      wantListenRef.current = false;
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    wantListenRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    stop();
    const rec = new Ctor();
    rec.lang = "es-MX";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (ev) => {
      let interim = "";
      let finalText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const chunk = ev.results[i][0]?.transcript ?? "";
        if (ev.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }
      const text = (finalText || interim).trim();
      if (text) onText(text, Boolean(finalText));
    };
    rec.onerror = () => stop();
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (wantListenRef.current) {
        window.setTimeout(() => start(), 200);
      }
    };
    recRef.current = rec;
    wantListenRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      wantListenRef.current = false;
      setListening(false);
    }
  }, [onText, stop]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { listening, supported, toggle, start, stop };
}
