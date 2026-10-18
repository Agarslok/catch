"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logMeetingActivity } from "@/lib/activity/log";
import {
  getBroadcastChannel,
  readLocalMax,
  readLocalStep,
  writeLocalStep,
} from "@/lib/meeting/local-sync";
import {
  clampScriptIndex,
  generateSessionScript,
  getPointAt,
  getPointIndex,
  mergePresentedChart,
  validateSessionScript,
} from "@/lib/meeting/script";
import type { PresentedChart, SessionScript } from "@/lib/meeting/script-types";
import {
  type MonitorSessionPhase,
  presenterDashboardReady,
  resolveInitialMonitorSessionPhase,
} from "@/lib/meeting/monitor-session-phase";
import type {
  MeetingGlobalView,
  MeetingPresentationStatus,
} from "@/lib/meeting/session-types";
import { syncDevSessionStorage } from "@/lib/meeting/dev-session-client";
import {
  mergeIncomingGlobalView,
  nextAppliedEventSeq,
  shouldApplyMeetingStateRow,
  sortMeetingStateRowsBySeq,
} from "@/lib/meeting/meeting-state-sync";
import {
  abortAdvance,
  beginAdvance,
  commitAdvance,
  emptyAdvanceLock,
  invalidatePendingOnPause,
  pendingMatchesGeneration,
  shouldSkipRetryAfterPersist,
  type AdvanceLockState,
} from "@/lib/meeting/presentation-recovery";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ChartAction } from "@/lib/visualization/types";

type StateRow = {
  current_step?: number;
  unlocked_step?: number;
  current_point_id?: string | null;
  presentation_status?: MeetingPresentationStatus;
  global_view?: MeetingGlobalView;
  event_seq?: number;
  script?: SessionScript | null;
  presented_charts?: PresentedChart[];
};

export function useMeetingSync(
  meetingId: string,
  isPresenter: boolean,
  presenterToken?: string,
) {
  const [script, setScript] = useState<SessionScript>(() =>
    generateSessionScript(meetingId),
  );
  const [liveStep, setLiveStep] = useState(0);
  const [unlockedStep, setUnlockedStep] = useState(0);
  const [livePointId, setLivePointId] = useState("intro");
  const [presentationStatus, setPresentationStatus] =
    useState<MeetingPresentationStatus>("live");
  const [globalView, setGlobalView] = useState<MeetingGlobalView>({});
  const [sessionPhase, setSessionPhase] =
    useState<MonitorSessionPhase>("preparacion");
  const [presentedCharts, setPresentedCharts] = useState<PresentedChart[]>([]);
  const [eventSeq, setEventSeq] = useState(0);
  const [ready, setReady] = useState(false);
  const publishing = useRef(false);
  const devFreshRef = useRef<boolean | null>(null);
  const scriptRef = useRef(script);
  scriptRef.current = script;
  const sessionPhaseRef = useRef(sessionPhase);
  sessionPhaseRef.current = sessionPhase;
  const appliedEventSeqRef = useRef(-1);
  const hydratedRef = useRef(false);
  const presentationStatusRef = useRef(presentationStatus);
  presentationStatusRef.current = presentationStatus;
  const liveStepRef = useRef(liveStep);
  liveStepRef.current = liveStep;
  const advanceLockRef = useRef<AdvanceLockState>(emptyAdvanceLock(0));

  const devSessionFresh = useCallback(() => {
    if (devFreshRef.current === null) {
      devFreshRef.current = syncDevSessionStorage();
    }
    return devFreshRef.current;
  }, []);

  const applyRemoteState = useCallback((row: StateRow, options?: { force?: boolean }) => {
    if (
      !options?.force &&
      !shouldApplyMeetingStateRow(appliedEventSeqRef.current, row)
    ) {
      return false;
    }
    appliedEventSeqRef.current = nextAppliedEventSeq(appliedEventSeqRef.current, row);

    const incoming = row.script ? validateSessionScript(row.script) : null;
    const nextScript =
      incoming && incoming.ok ? incoming.script : scriptRef.current;
    if (incoming && incoming.ok) setScript(incoming.script);

    const idx =
      row.current_point_id != null
        ? getPointIndex(nextScript, row.current_point_id)
        : clampScriptIndex(nextScript, row.current_step ?? 0);
    const safeIdx = idx >= 0 ? idx : 0;
    const point = getPointAt(nextScript, safeIdx);
    const unlocked =
      row.unlocked_step != null
        ? clampScriptIndex(nextScript, row.unlocked_step)
        : safeIdx;
    const phase = resolveInitialMonitorSessionPhase(
      row.global_view?.monitorSessionPhase,
      safeIdx,
      unlocked,
    );
    setSessionPhase(phase);
    if (row.presentation_status) setPresentationStatus(row.presentation_status);
    if (row.global_view) {
      setGlobalView((prev) => mergeIncomingGlobalView(prev, row.global_view));
    }
    const visitorWaiting =
      !isPresenter && phase !== "reunion_activa" && phase !== "cierre";
    if (!visitorWaiting) {
      setLiveStep(safeIdx);
      setLivePointId(point.id);
      if (row.unlocked_step != null) {
        setUnlockedStep(clampScriptIndex(nextScript, row.unlocked_step));
      } else {
        setUnlockedStep((prev) => Math.max(prev, safeIdx));
      }
    }
    if (row.presented_charts) setPresentedCharts(row.presented_charts);
    if (typeof row.event_seq === "number") setEventSeq(row.event_seq);
    return true;
  }, [isPresenter]);

  const fetchPersistedState = useCallback(async (): Promise<StateRow | null> => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("meeting_state")
        .select(
          "current_step, unlocked_step, current_point_id, presentation_status, global_view, event_seq, script, presented_charts",
        )
        .eq("meeting_id", meetingId)
        .maybeSingle();
      if (!error && data) return data as StateRow;
    }
    try {
      const res = await fetch(`/api/meeting/${meetingId}/state`);
      if (!res.ok) return null;
      const json = (await res.json()) as { state?: StateRow };
      return json.state ?? null;
    } catch {
      return null;
    }
  }, [meetingId]);

  const refreshGlobalState = useCallback(async () => {
    const row = await fetchPersistedState();
    if (row) applyRemoteState(row, { force: true });
    return row;
  }, [fetchPersistedState, applyRemoteState]);

  useEffect(() => {
    devSessionFresh();
    const total = scriptRef.current.points.length;
    const step = readLocalStep(meetingId, total);
    const max = Math.max(readLocalMax(meetingId, total), step);
    setLiveStep(step);
    setUnlockedStep(max);
    setLivePointId(getPointAt(scriptRef.current, step).id);
    setReady(true);
  }, [meetingId]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      const bc = getBroadcastChannel();
      const onMessage = (e: MessageEvent) => {
        const d = e.data;
        if (d?.type === "step") {
          const s = clampScriptIndex(scriptRef.current, d.s);
          setLiveStep(s);
          setUnlockedStep(
            clampScriptIndex(
              scriptRef.current,
              typeof d.max === "number" ? d.max : s,
            ),
          );
          setLivePointId(getPointAt(scriptRef.current, s).id);
        }
        if (d?.type === "state" && d.row) applyRemoteState(d.row as StateRow);
      };
      bc?.addEventListener("message", onMessage);
      return () => {
        bc?.removeEventListener("message", onMessage);
      };
    }

    let cancelled = false;
    const pendingRealtime: StateRow[] = [];
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const flushRow = (row: StateRow) => {
      applyRemoteState(row);
    };

    const onRealtime = (payload: { new: Record<string, unknown> }) => {
      const row = payload.new as StateRow;
      if (!hydratedRef.current) {
        pendingRealtime.push(row);
        return;
      }
      flushRow(row);
    };

    (async () => {
      const devFresh = devSessionFresh();

      if (!cancelled && devFresh && isPresenter && presenterToken) {
        await fetch(`/api/meeting/${meetingId}/state`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-presenter-token": presenterToken,
          },
          body: JSON.stringify({
            currentStep: 0,
            unlockedStep: 0,
            script: scriptRef.current,
            reset: true,
          }),
        });
      }

      const data = await fetchPersistedState();

      if (!cancelled && data) {
        applyRemoteState(data, { force: true });
      } else if (!cancelled && isPresenter && presenterToken) {
        await fetch(`/api/meeting/${meetingId}/state`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-presenter-token": presenterToken,
          },
          body: JSON.stringify({
            currentStep: 0,
            unlockedStep: 0,
            script: scriptRef.current,
            reset: true,
          }),
        });
        const seeded = await fetchPersistedState();
        if (!cancelled && seeded) applyRemoteState(seeded, { force: true });
      }

      if (cancelled) return;

      hydratedRef.current = true;
      for (const row of sortMeetingStateRowsBySeq(pendingRealtime) as StateRow[]) {
        flushRow(row);
      }
      pendingRealtime.length = 0;

      channel = supabase
        .channel(`meeting-state:${meetingId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "meeting_state",
            filter: `meeting_id=eq.${meetingId}`,
          },
          onRealtime,
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      hydratedRef.current = false;
      appliedEventSeqRef.current = -1;
      if (channel) supabase.removeChannel(channel);
    };
  }, [
    meetingId,
    isPresenter,
    presenterToken,
    applyRemoteState,
    devSessionFresh,
    fetchPersistedState,
  ]);

  const pushRemote = useCallback(
    async (body: Record<string, unknown>) => {
      const nextStep =
        typeof body.currentStep === "number" ? body.currentStep : liveStep;
      const nextUnlocked =
        typeof body.unlockedStep === "number" ? body.unlockedStep : unlockedStep;
      writeLocalStep(meetingId, nextStep, nextUnlocked);

      const point = getPointAt(scriptRef.current, nextStep);
      const row: StateRow = {
        current_step: nextStep,
        unlocked_step: nextUnlocked,
        current_point_id: point.id,
        presentation_status:
          (body.presentationStatus as MeetingPresentationStatus) ??
          presentationStatus,
        global_view: body.globalView
          ? { ...globalView, ...(body.globalView as MeetingGlobalView) }
          : globalView,
        script: (body.script as SessionScript) ?? scriptRef.current,
        presented_charts: presentedCharts,
      };
      getBroadcastChannel()?.postMessage({ type: "state", row });

      if (presenterToken) {
        const res = await fetch(`/api/meeting/${meetingId}/state`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-presenter-token": presenterToken,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.warn("[meeting_state API]", err.error ?? res.status);
        } else {
          const json = (await res.json().catch(() => ({}))) as { state?: StateRow };
          if (json.state) applyRemoteState(json.state);
        }
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (supabase && isPresenter) {
        const { error } = await supabase.from("meeting_state").upsert({
          meeting_id: meetingId,
          current_step: nextStep,
          unlocked_step: nextUnlocked,
          current_point_id: point.id,
          updated_at: new Date().toISOString(),
        });
        if (error) console.warn("[meeting_state]", error.message);
      }
    },
    [
      meetingId,
      isPresenter,
      presenterToken,
      liveStep,
      unlockedStep,
      presentationStatus,
      globalView,
      presentedCharts,
      applyRemoteState,
    ],
  );

  const publishStep = useCallback(
    async (step: number, reset?: boolean) => {
      if (!isPresenter || publishing.current) return;
      if (!presenterDashboardReady(sessionPhaseRef.current)) return;
      if (presentationStatusRef.current === "paused") return;
      const s = clampScriptIndex(scriptRef.current, step);
      if (
        shouldSkipRetryAfterPersist({
          persistedStep: liveStepRef.current,
          intendedStep: s,
        }) &&
        !reset
      ) {
        return;
      }
      const started = beginAdvance(advanceLockRef.current, s);
      if (!started.ok) return;
      advanceLockRef.current = started.lock;
      publishing.current = true;
      try {
        if (
          !pendingMatchesGeneration(
            advanceLockRef.current,
            started.generation,
            presentationStatusRef.current,
          )
        ) {
          advanceLockRef.current = abortAdvance(
            advanceLockRef.current,
            started.generation,
          );
          return;
        }
        const max = reset ? s : Math.max(unlockedStep, s);
        const point = getPointAt(scriptRef.current, s);
        setLiveStep(s);
        setUnlockedStep(max);
        setLivePointId(point.id);
        if (point.kind === "chart" && point.sectionId) {
          const sectionId = point.sectionId;
          setPresentedCharts((prev) => {
            let next = prev;
            for (const ref of point.chartRefs) {
              next = mergePresentedChart(next, {
                key: `${sectionId}:${point.id}:${ref.id}`,
                meetingId,
                sectionId,
                pointId: point.id,
                chartId: ref.id,
                title: point.title,
                chapterIndex: ref.chapterIndex,
                beat: ref.beat,
                order: next.length,
              });
            }
            return next;
          });
        }
        if (
          !pendingMatchesGeneration(
            advanceLockRef.current,
            started.generation,
            presentationStatusRef.current,
          )
        ) {
          advanceLockRef.current = abortAdvance(
            advanceLockRef.current,
            started.generation,
          );
          return;
        }
        await pushRemote({
          currentStep: s,
          currentPointId: point.id,
          unlockedStep: max,
          reset: Boolean(reset),
          script: scriptRef.current,
        });
        advanceLockRef.current = commitAdvance(
          advanceLockRef.current,
          started.generation,
          s,
        );
        await logMeetingActivity({
          meetingId,
          eventType: "PRESENTATION_STEP",
          scope: "global",
          actor: { id: "presenter", name: "Presentador" },
          payload: { step: s, pointId: point.id, unlockedStep: max, reset: Boolean(reset) },
        });
      } finally {
        publishing.current = false;
      }
    },
    [meetingId, isPresenter, unlockedStep, pushRemote],
  );

  const publishPoint = useCallback(
    async (pointId: string, reset?: boolean) => {
      const idx = getPointIndex(scriptRef.current, pointId);
      if (idx < 0) return;
      await publishStep(idx, reset);
    },
    [publishStep],
  );

  const setPresentationPaused = useCallback(
    async (paused: boolean) => {
      if (!isPresenter) return;
      const status: MeetingPresentationStatus = paused ? "paused" : "live";
      if (paused) {
        advanceLockRef.current = invalidatePendingOnPause(advanceLockRef.current);
      }
      setPresentationStatus(status);
      presentationStatusRef.current = status;
      await pushRemote({ presentationStatus: status });
    },
    [isPresenter, pushRemote],
  );

  const setAvatarVideoPaused = useCallback(
    async (paused: boolean) => {
      if (!isPresenter) return;
      setGlobalView((prev) => ({ ...prev, avatarVideoPaused: paused }));
      await pushRemote({ globalView: { avatarVideoPaused: paused } });
    },
    [isPresenter, pushRemote],
  );

  const publishGlobalAction = useCallback(
    async (action: ChartAction) => {
      if (!isPresenter) return;
      await pushRemote({ action });
    },
    [isPresenter, pushRemote],
  );

  const publishSessionPhase = useCallback(
    async (phase: MonitorSessionPhase) => {
      if (!isPresenter) return;
      setSessionPhase(phase);
      setGlobalView((prev) => ({ ...prev, monitorSessionPhase: phase }));
      await pushRemote({ globalView: { monitorSessionPhase: phase } });
    },
    [isPresenter, pushRemote],
  );

  const publishGlobalViewPatch = useCallback(
    async (patch: Partial<MeetingGlobalView>) => {
      if (!isPresenter) return;
      setGlobalView((prev) => ({ ...prev, ...patch }));
      await pushRemote({ globalView: patch });
    },
    [isPresenter, pushRemote],
  );

  return {
    script,
    liveStep,
    unlockedStep,
    livePointId,
    presentationStatus,
    globalView,
    presentedCharts,
    eventSeq,
    publishStep,
    publishPoint,
    setPresentationPaused,
    setAvatarVideoPaused,
    publishGlobalAction,
    sessionPhase,
    publishSessionPhase,
    publishGlobalViewPatch,
    refreshGlobalState,
    ready,
  };
}
