"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logMeetingActivity } from "@/lib/activity/log";
import {
  getBroadcastChannel,
  readLocalMax,
  readLocalStep,
  writeLocalStep,
} from "@/lib/meeting/local-sync";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { TOTAL_STEPS } from "@/lib/data/guanajuato-2026";

export function useMeetingSync(meetingId: string, isPresenter: boolean) {
  const [liveStep, setLiveStep] = useState(0);
  const [unlockedStep, setUnlockedStep] = useState(0);
  const [ready, setReady] = useState(false);
  const publishing = useRef(false);

  const applyStep = useCallback((step: number, max: number) => {
    setLiveStep(step);
    setUnlockedStep(max);
  }, []);

  useEffect(() => {
    const step = readLocalStep(meetingId, TOTAL_STEPS);
    const max = Math.max(readLocalMax(meetingId, TOTAL_STEPS), step);
    applyStep(step, max);
    setReady(true);
  }, [meetingId, applyStep]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      const bc = getBroadcastChannel();
      const onMessage = (e: MessageEvent) => {
        const d = e.data;
        if (d?.type === "step") {
          applyStep(d.s, typeof d.max === "number" ? d.max : d.s);
        }
      };
      bc?.addEventListener("message", onMessage);

      const onStorage = (e: StorageEvent) => {
        const keys = `catch:${meetingId}:`;
        if (e.key === `${keys}step` && e.newValue != null) {
          const s = parseInt(e.newValue, 10) || 0;
          const max = readLocalMax(meetingId, TOTAL_STEPS);
          applyStep(s, max);
        }
        if (e.key === `${keys}max` && e.newValue != null) {
          setUnlockedStep(parseInt(e.newValue, 10) || 0);
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        bc?.removeEventListener("message", onMessage);
        window.removeEventListener("storage", onStorage);
      };
    }

    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("meeting_state")
        .select("current_step, unlocked_step")
        .eq("meeting_id", meetingId)
        .maybeSingle();

      if (!cancelled && data) {
        applyStep(data.current_step ?? 0, data.unlocked_step ?? 0);
      } else if (!cancelled && isPresenter) {
        const { error } = await supabase.from("meeting_state").upsert({
          meeting_id: meetingId,
          current_step: 0,
          unlocked_step: 0,
          updated_at: new Date().toISOString(),
        });
        if (error) console.warn("[meeting_state init]", error.message);
      }
    })();

    const channel = supabase
      .channel(`meeting-state:${meetingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meeting_state",
          filter: `meeting_id=eq.${meetingId}`,
        },
        (payload) => {
          const row = payload.new as {
            current_step?: number;
            unlocked_step?: number;
          };
          if (row?.current_step != null) {
            applyStep(
              row.current_step,
              row.unlocked_step ?? row.current_step,
            );
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [meetingId, isPresenter, applyStep]);

  const publishStep = useCallback(
    async (step: number, reset?: boolean) => {
      if (publishing.current) return;
      publishing.current = true;
      try {
        const max = reset ? step : Math.max(unlockedStep, step);
        applyStep(step, max);
        writeLocalStep(meetingId, step, max);

        const bc = getBroadcastChannel();
        bc?.postMessage({ type: "step", s: step, max });

        const supabase = getSupabaseBrowserClient();
        if (supabase && isPresenter) {
          const { error } = await supabase.from("meeting_state").upsert({
            meeting_id: meetingId,
            current_step: step,
            unlocked_step: max,
            updated_at: new Date().toISOString(),
          });
          if (error) console.warn("[meeting_state]", error.message);
          await logMeetingActivity({
            meetingId,
            eventType: "PRESENTATION_STEP",
            scope: "global",
            actor: { id: "presenter", name: "Presentador" },
            payload: { step, unlockedStep: max, reset: Boolean(reset) },
          });
        }
      } finally {
        publishing.current = false;
      }
    },
    [meetingId, isPresenter, unlockedStep, applyStep],
  );

  return { liveStep, unlockedStep, publishStep, ready };
}
