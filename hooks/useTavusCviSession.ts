"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyCall } from "@daily-co/daily-js";
import {
  errorMessageFromApiBody,
  formatUnknownError,
} from "@/lib/http/api-error";
import { buildConversationInterrupt } from "@/lib/tavus/interactions";
import { sendConversationEcho } from "@/lib/tavus/present-echo";
import {
  joinTavusDailyCall,
  syncExistingRemoteTracks,
  wireDailyRemoteTracks,
} from "@/lib/tavus/daily-tracks";

export type TavusCviStatus = "idle" | "starting" | "connected" | "error" | "ended";

type StartOptions = {
  meetingId?: string;
  presenterToken?: string;
  /** Conversación Tavus propia: no escribe la sesión de una reunión. */
  detached?: boolean;
};

export function useTavusCviSession(canStart: boolean) {
  const [configured, setConfigured] = useState(false);
  const [status, setStatus] = useState<TavusCviStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"local" | "tavus">("local");

  const callRef = useRef<DailyCall | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unwireTracksRef = useRef<(() => void) | null>(null);
  const lastEchoIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "connected") return;
    const call = callRef.current;
    if (!call) return;
    syncExistingRemoteTracks(call, () => videoRef.current, () => audioRef.current);
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/tavus/conversation")
      .then(async (r) => {
        const raw = await r.text();
        try {
          return JSON.parse(raw) as { configured?: boolean; error?: string };
        } catch {
          throw new Error("No se pudo leer /api/tavus/conversation");
        }
      })
      .then((d) => {
        if (cancelled) return;
        setConfigured(Boolean(d.configured));
        if (!d.configured) {
          setStatus("error");
          setError(
            d.error ||
              "Tavus no está configurado en el servidor (TAVUS_API_KEY, TAVUS_REPLICA_ID, TAVUS_PERSONA_ID).",
          );
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setConfigured(false);
        setStatus("error");
        setError(e instanceof Error ? e.message : "No se pudo comprobar Tavus");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const detachCall = useCallback(async () => {
    const call = callRef.current;
    callRef.current = null;
    conversationIdRef.current = null;
    if (call) {
      try {
        await call.leave();
      } catch {
        /* ignore */
      }
      try {
        await call.destroy();
      } catch {
        /* ignore */
      }
    }
    unwireTracksRef.current?.();
    unwireTracksRef.current = null;
    lastEchoIdRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
    const a = audioRef.current;
    if (a) a.srcObject = null;
  }, []);

  const endSession = useCallback(
    async (opts?: StartOptions) => {
      const id = conversationIdRef.current;
      await detachCall();
      if (id && canStart) {
        const detached = opts?.detached === true;
        try {
          await fetch(
            detached
              ? `/api/async/avatar/${encodeURIComponent(id)}/end`
              : `/api/tavus/conversation/${encodeURIComponent(id)}/end`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(!detached && opts?.presenterToken
                  ? { "x-presenter-token": opts.presenterToken }
                  : {}),
              },
              body: JSON.stringify(
                detached ? {} : { meetingId: opts?.meetingId ?? undefined },
              ),
            },
          );
        } catch {
          /* ignore */
        }
      }
      setStatus("ended");
      setMode("local");
      setError(null);
    },
    [canStart, detachCall],
  );

  const connectConversation = useCallback(
    async (opts: StartOptions, forceNew: boolean) => {
      const detached = opts.detached === true;
      const res = await fetch(detached ? "/api/async/avatar" : "/api/tavus/conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(!detached && opts.presenterToken
            ? { "x-presenter-token": opts.presenterToken }
            : {}),
        },
        body: JSON.stringify(
          detached
            ? { conversationName: "catch-async", forceNew }
            : {
                meetingId: opts.meetingId,
                conversationName: opts.meetingId ? `catch-${opts.meetingId}` : undefined,
                forceNew,
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          errorMessageFromApiBody(data, "No se pudo crear la conversación Tavus"),
        );
      }

      const DailyIframe = (await import("@daily-co/daily-js")).default;
      const call = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
      });
      callRef.current = call;
      conversationIdRef.current = data.conversationId as string;

      unwireTracksRef.current = wireDailyRemoteTracks(
        call,
        () => videoRef.current,
        () => audioRef.current,
      );

      call.on("left-meeting", () => {
        setStatus("ended");
        setMode("local");
      });

      call.on("error", (ev) => {
        setError(formatUnknownError(ev, "Error en la llamada Daily"));
        setStatus("error");
      });

      await joinTavusDailyCall(call, {
        url: data.conversationUrl as string,
        token: (data.meetingToken as string | null) || undefined,
      });

      syncExistingRemoteTracks(call, () => videoRef.current, () => audioRef.current);
      setStatus("connected");
      return Boolean(data.reused);
    },
    [],
  );

  const startSession = useCallback(
    async (opts?: StartOptions) => {
      if (!canStart || (!opts?.detached && !opts?.meetingId)) return;
      if (!configured) {
        setStatus("error");
        setError(
          "Tavus no está configurado en el servidor. Defina las variables TAVUS_* en Netlify.",
        );
        return;
      }
      if (startingRef.current || status === "starting") return;
      if (callRef.current) return;

      startingRef.current = true;
      setError(null);
      setStatus("starting");
      setMode("tavus");

      try {
        await connectConversation(opts, false);
      } catch {
        await detachCall();
        setStatus("starting");
        setMode("tavus");
        try {
          await connectConversation(opts, true);
        } catch (second) {
          await detachCall();
          setMode("local");
          setStatus("error");
          setError(
            formatUnknownError(second, "Error al conectar con Tavus"),
          );
        }
      } finally {
        startingRef.current = false;
      }
    },
    [canStart, configured, connectConversation, detachCall, status],
  );

  const interruptSpeech = useCallback(() => {
    const call = callRef.current;
    const conversationId = conversationIdRef.current;
    if (!call || !conversationId || status !== "connected") return false;
    try {
      call.sendAppMessage(buildConversationInterrupt(conversationId), "*");
      return true;
    } catch {
      return false;
    }
  }, [status]);

  const speakEcho = useCallback((text: string, echoId?: string) => {
    const call = callRef.current;
    const conversationId = conversationIdRef.current;
    if (!call || !conversationId || status !== "connected") return false;
    return sendConversationEcho(
      (payload, target) => call.sendAppMessage(payload, target),
      conversationId,
      text,
      lastEchoIdRef,
      echoId,
    );
  }, [status]);

  const detachRef = useRef(detachCall);
  detachRef.current = detachCall;
  useEffect(() => {
    return () => {
      void detachRef.current();
    };
  }, [detachCall]);

  return {
    configured,
    status,
    error,
    mode,
    setMode,
    videoRef,
    audioRef,
    startSession,
    endSession,
    speakEcho,
    interruptSpeech,
    tavusActive: mode === "tavus" && status === "connected",
  };
}
