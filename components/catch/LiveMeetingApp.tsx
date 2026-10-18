"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvatarDockVideo } from "@/components/catch/AvatarDockVideo";
import { PresenterAvatarWidget } from "@/components/catch/PresenterAvatarWidget";
import { TavusAiEcho } from "@/components/catch/TavusAiEcho";
import { TavusCviProvider } from "@/components/catch/TavusCviProvider";
import { StoryRail } from "@/components/catch/StoryRail";
import { ChapterCharts } from "@/components/charts/ChapterCharts";
import { logMeetingActivity } from "@/lib/activity/log";
import {
  CHAPTERS,
  type ChartKind,
  type MunFilter,
} from "@/lib/data/guanajuato-2026";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { useMeetingSync } from "@/hooks/useMeetingSync";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  ClarityStepView,
  ClosingView,
  ConceptReviewView,
  FullSheetView,
  IntroductionView,
  PresenterGeneratingView,
  PresenterPreparationView,
  VisitorWaitingView,
} from "@/components/catch/SectionStepViews";
import {
  presenterDashboardReady,
  presenterInPreMeetingReview,
  presenterSeesDashboard,
  visitorSeesMeeting,
} from "@/lib/meeting/monitor-session-phase";
import { useSupabaseHealth } from "@/hooks/useSupabaseHealth";
import { useInteractionAnalytics } from "@/hooks/useInteractionAnalytics";
import { MeetingAnalyticsPanel } from "@/components/catch/MeetingAnalyticsPanel";
import { MeetingVisitorTools } from "@/components/catch/MeetingVisitorTools";
import { PresenterEngagementPanel } from "@/components/catch/PresenterEngagementPanel";
import { PrivateQuestionPanel } from "@/components/catch/PrivateQuestionPanel";
import { applyChartActionToGlobalView } from "@/lib/meeting/global-view";
import {
  adjacentNavigableIndex,
  chapterMeta,
  getPointAt,
  getPointById,
  getPointIndex,
  remapHiddenPoint,
  sectionForPoint,
  specialPointId,
} from "@/lib/meeting/script";
import {
  estimateNarrationDurationMs,
  scriptContinueTarget,
  scriptPointAwaitingModerator,
  shouldBlockDuplicateContinue,
} from "@/lib/meeting/section-flow";
import {
  recoveryNotice,
  type RecoveryNotice,
} from "@/lib/meeting/presentation-recovery";
import type { LocalExploreMode } from "@/lib/meeting/script-types";
import type { ClarityVote } from "@/lib/meeting/session-types";
import { validateChartAction } from "@/lib/visualization/actions";
import {
  downloadAvatarScriptPdf,
  downloadCatchFeedbackPdf,
  downloadClientSessionPdf,
} from "@/lib/meeting/pdf-export";

type Props = {
  meetingId: string;
  role: "presenter" | "visitor";
  presenterToken?: string;
};

function getVisitorActor(meetingId: string) {
  if (typeof window === "undefined") {
    return { id: "visitor", name: "Visitante" };
  }
  const key = `catch:${meetingId}:actor`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as { id: string; name: string };
    const id = `v-${Math.random().toString(36).slice(2, 9)}`;
    const name = `Visitante ${id.slice(-4)}`;
    const actor = { id, name };
    localStorage.setItem(key, JSON.stringify(actor));
    return actor;
  } catch {
    return { id: "visitor", name: "Visitante" };
  }
}

export function LiveMeetingApp({ meetingId, role, presenterToken }: Props) {
  const isPresenter = role === "presenter";
  const {
    script,
    liveStep,
    unlockedStep,
    livePointId,
    publishStep,
    publishPoint,
    presentationStatus,
    globalView,
    eventSeq,
    setPresentationPaused,
    setAvatarVideoPaused,
    publishGlobalAction,
    sessionPhase,
    publishSessionPhase,
    publishGlobalViewPatch,
    refreshGlobalState,
    ready,
  } = useMeetingSync(meetingId, isPresenter, presenterToken);

  const [prepFileName, setPrepFileName] = useState("");
  const [genMessage, setGenMessage] = useState("");
  const [prepBusy, setPrepBusy] = useState(false);
  const [presenterPreviewPointId, setPresenterPreviewPointId] = useState("");

  const [follow, setFollow] = useState(true);
  const [ownPointId, setOwnPointId] = useState(livePointId);
  const [exploreMode, setExploreMode] = useState<LocalExploreMode>("follow");
  const [sheetReturnId, setSheetReturnId] = useState<string | null>(null);
  const [peekPointId, setPeekPointId] = useState<string | null>(null);
  const [chartHighlight, setChartHighlight] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [privateAskOpen, setPrivateAskOpen] = useState(false);
  const [participantToken, setParticipantToken] = useState("");
  const [munFilter, setMunFilter] = useState<MunFilter>("total");
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const [question, setQuestion] = useState("");
  const [askOk, setAskOk] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [aiReplySeq, setAiReplySeq] = useState(0);
  const [clarityVote, setClarityVote] = useState<ClarityVote | null>(null);
  const [clarityPromptDismissed, setClarityPromptDismissed] = useState(false);
  const [qOpen, setQOpen] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryNotice | null>(null);
  const isMobile = useMediaQuery("(max-width: 860px)");
  const showLeftRail = !isMobile || isPresenter;
  const showDockVideo = !isMobile;
  const showFloatingAvatar = isMobile;
  const avatarVideoPaused = globalView.avatarVideoPaused ?? false;
  const avatarVideoProps = {
    syncPaused: avatarVideoPaused,
    canControlPause: isPresenter,
    onTogglePause: () => void setAvatarVideoPaused(!avatarVideoPaused),
  };
  const chatRef = useRef<HTMLInputElement>(null);
  const narrationExecRef = useRef<string | null>(null);
  const sectionDedupRef = useRef<string | null>(null);
  const lastContinueAtRef = useRef<number | null>(null);
  const actorRef = useRef(
    isPresenter
      ? { id: "presenter", name: "Presentador" }
      : getVisitorActor(meetingId),
  );
  const { track: trackAnalytics } = useInteractionAnalytics({
    meetingId,
    role,
    participantId: actorRef.current.id,
  });
  const activity = useActivityFeed(meetingId, isPresenter);
  const { health: supabaseHealth, loading: supabaseLoading } = useSupabaseHealth();

  useEffect(() => {
    if (!isPresenter && follow) {
      setOwnPointId(livePointId);
      setExploreMode("follow");
      setPeekPointId(null);
      setSheetReturnId(null);
    }
  }, [livePointId, follow, isPresenter]);

  useEffect(() => {
    if (isPresenter) return;
    const id = actorRef.current.id;
    const storedKey = `catch:${meetingId}:pt`;
    let existing = "";
    try {
      existing = window.localStorage.getItem(storedKey) ?? "";
    } catch {
      existing = "";
    }
    void fetch(`/api/meeting/${meetingId}/participant-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: id, existingToken: existing }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.token) return;
        setParticipantToken(d.token as string);
        try {
          window.localStorage.setItem(storedKey, d.token as string);
        } catch {
          /* ignore quota */
        }
      })
      .catch(() => {});
  }, [isPresenter, meetingId]);

  useEffect(() => {
    if (isPresenter) setPeekPointId(null);
  }, [livePointId, isPresenter]);

  const presenterPreMeetingReview =
    isPresenter && presenterInPreMeetingReview(sessionPhase);

  useEffect(() => {
    if (presenterPreMeetingReview) {
      setPresenterPreviewPointId(livePointId);
    }
  }, [presenterPreMeetingReview, livePointId, sessionPhase]);

  useEffect(() => {
    if (!follow || isPresenter) return;
    if (globalView.munFilter) setMunFilter(globalView.munFilter);
    if (globalView.chartKind) setChartKind(globalView.chartKind);
  }, [follow, isPresenter, globalView, eventSeq]);

  const currentPointId =
    peekPointId ??
    (presenterPreMeetingReview
      ? presenterPreviewPointId || livePointId
      : isPresenter
        ? livePointId
        : follow
          ? livePointId
          : ownPointId);
  const currentPoint = remapHiddenPoint(
    script,
    getPointById(script, currentPointId) ?? getPointAt(script, liveStep),
  );
  const currentIndex = getPointIndex(script, currentPoint.id);
  const totalPoints = script.points.length;
  const section = sectionForPoint(script, currentPoint);
  const chartRef = currentPoint.chartRefs[0];
  const chapterIndex = chartRef?.chapterIndex ?? 0;
  const beat = chartRef?.beat ?? 0;
  const c = chapterMeta(chapterIndex) ?? CHAPTERS[0];
  const alignedWithGlobal = follow || currentPoint.id === livePointId;
  const groupAwaitingModerator = globalView.awaitingModerator === true;
  const livePoint = getPointById(script, livePointId);
  const clarityAwaitSectionId =
    globalView.sectionAwaitSectionId ??
    (livePoint?.sectionId &&
    (livePoint.kind === "full_sheet" || livePoint.kind === "clarity_check")
      ? livePoint.sectionId
      : null);
  const liveSheetOrClarity =
    livePoint?.kind === "full_sheet" || livePoint?.kind === "clarity_check";
  const visitorClarityPrompt =
    !isPresenter &&
    follow &&
    !reviewOpen &&
    !peekPointId &&
    !clarityPromptDismissed &&
    liveSheetOrClarity &&
    Boolean(clarityAwaitSectionId || livePoint?.sectionId);

  const pdfMeta = useMemo(
    () => ({
      editionLabel: script.title || "Monitor de Mercado Laboral",
      clientLabel: "Su empresa",
      meetingId,
      sectionNames: script.sections.map((s) => s.name),
    }),
    [script, meetingId],
  );

  const onDownloadClientPdf = useCallback(() => {
    downloadClientSessionPdf(script, pdfMeta);
  }, [script, pdfMeta]);

  const onDownloadCatchPdf = useCallback(() => {
    downloadCatchFeedbackPdf(pdfMeta);
  }, [pdfMeta]);

  const runSimulatedReportGeneration = useCallback(async () => {
    if (prepBusy || sessionPhase !== "preparacion" || !isPresenter) return;
    setPrepBusy(true);
    const messages = [
      "Preparando la información",
      "Organizando las secciones del informe",
      "Preparando el guion del avatar",
    ];
    await publishSessionPhase("generando_informe");
    const t0 = Date.now();
    for (const m of messages) {
      setGenMessage(m);
      await new Promise((r) => setTimeout(r, 750));
    }
    const rest = 2200 - (Date.now() - t0);
    if (rest > 0) await new Promise((r) => setTimeout(r, rest));
    setGenMessage("");
    await publishSessionPhase("revision_previa");
    setPrepBusy(false);
  }, [isPresenter, prepBusy, publishSessionPhase, sessionPhase]);

  const startMeetingFromReady = useCallback(async () => {
    if (!presenterInPreMeetingReview(sessionPhase) || !isPresenter) return;
    await publishSessionPhase("reunion_activa");
    await publishStep(liveStep);
  }, [isPresenter, liveStep, publishSessionPhase, publishStep, sessionPhase]);

  const onDownloadAvatarScriptPdf = useCallback(() => {
    downloadAvatarScriptPdf(script, pdfMeta);
  }, [script, pdfMeta]);

  const returnToPresentation = useCallback(() => {
    void refreshGlobalState().then((row) => {
      const pointId = row?.current_point_id ?? livePointId;
      setFollow(true);
      setOwnPointId(pointId);
      setExploreMode("follow");
      setSheetReturnId(null);
      setPeekPointId(null);
      setReviewOpen(false);
      trackAnalytics("explore.returned_to_presentation", {
        chart_id: c.chartFocus,
        metadata: { pointId },
      });
    });
  }, [livePointId, refreshGlobalState, trackAnalytics, c.chartFocus]);

  const liveSectionOrder = useMemo(() => {
    const point = getPointById(script, livePointId);
    if (!point) return -1;
    return sectionForPoint(script, point)?.order ?? -1;
  }, [script, livePointId]);

  const prevLiveSectionOrderRef = useRef<number | null>(null);
  useEffect(() => {
    if (isPresenter) {
      prevLiveSectionOrderRef.current = liveSectionOrder;
      return;
    }
    const prev = prevLiveSectionOrderRef.current;
    if (prev !== null && liveSectionOrder > prev) {
      returnToPresentation();
    }
    prevLiveSectionOrderRef.current = liveSectionOrder;
  }, [liveSectionOrder, isPresenter, returnToPresentation]);

  const goLocal = useCallback(
    (pointId: string, mode: LocalExploreMode) => {
      const idx = getPointIndex(script, pointId);
      if (idx < 0 || idx > unlockedStep) return;
      setFollow(false);
      setOwnPointId(pointId);
      setExploreMode(mode);
      if (mode !== "summary_origin") setSheetReturnId(null);
      trackAnalytics("explore.started", {
        chart_id: c.chartFocus,
        metadata: { pointId, mode },
      });
    },
    [script, unlockedStep, trackAnalytics, c.chartFocus],
  );

  useEffect(() => {
    if (!isPresenter || !presenterDashboardReady(sessionPhase)) return;
    if (presentationStatus === "paused") {
      setRecovery(recoveryNotice("paused_pending"));
      return;
    }
    const point = getPointById(script, livePointId);
    if (!point) return;
    setRecovery(null);
    const text =
      point.narrative ||
      (point.kind === "chart" && point.chartRefs[0]
        ? chapterMeta(point.chartRefs[0].chapterIndex)?.sub
        : "");
    const execId = `narr-${livePointId}-${Date.now()}`;
    narrationExecRef.current = execId;
    const ms = Math.max(estimateNarrationDurationMs(text), 1_200);
    const timer = window.setTimeout(() => {
      if (narrationExecRef.current !== execId) return;
      setRecovery(recoveryNotice("narration_unconfirmed"));
    }, ms);
    return () => window.clearTimeout(timer);
  }, [isPresenter, sessionPhase, livePointId, script, presentationStatus]);

  useEffect(() => {
    if (!isPresenter) return;
    const point = getPointById(script, livePointId);
    const sectionClosePoint =
      point?.kind === "clarity_check" || point?.kind === "full_sheet";
    if (sectionClosePoint && point.sectionId) {
      const alreadyForSection =
        groupAwaitingModerator && globalView.sectionAwaitSectionId === point.sectionId;
      if (!alreadyForSection) {
        const sec = script.sections.find((s) => s.id === point.sectionId);
        void publishGlobalViewPatch({
          awaitingModerator: true,
          sectionAwaitSectionId: point.sectionId,
          sectionAwaitSectionLabel: sec?.name ?? null,
        });
      }
    }
    const holdsSectionWait =
      scriptPointAwaitingModerator(point) || point?.kind === "full_sheet";
    if (point && !holdsSectionWait && groupAwaitingModerator) {
      sectionDedupRef.current = null;
      void publishGlobalViewPatch({
        awaitingModerator: false,
        sectionAwaitSectionId: null,
        sectionAwaitSectionLabel: null,
        sectionClosedPointId: null,
      });
    }
  }, [
    isPresenter,
    livePointId,
    script,
    groupAwaitingModerator,
    globalView.sectionAwaitSectionId,
    publishGlobalViewPatch,
  ]);

  const continueSection = useCallback(async () => {
    if (!isPresenter || shouldBlockDuplicateContinue(lastContinueAtRef.current)) return;
    if (presentationStatus === "paused") {
      setRecovery(recoveryNotice("paused_pending"));
      return;
    }
    const target = scriptContinueTarget(script, livePointId);
    if (!target.ok || !target.pointId) return;
    lastContinueAtRef.current = Date.now();
    sectionDedupRef.current = null;
    await publishGlobalViewPatch({
      awaitingModerator: false,
      sectionAwaitSectionId: null,
      sectionAwaitSectionLabel: null,
      sectionClosedPointId: null,
    });
    await publishPoint(target.pointId);
  }, [isPresenter, script, livePointId, publishGlobalViewPatch, publishPoint, presentationStatus]);

  const next = () => {
    if (presenterPreMeetingReview) {
      const idx = getPointIndex(script, currentPoint.id);
      const nxt = adjacentNavigableIndex(script, idx, 1);
      const wrap = nxt === idx;
      const target = wrap ? 0 : nxt;
      setPresenterPreviewPointId(getPointAt(script, target).id);
      return;
    }
    if (isPresenter) {
      if (groupAwaitingModerator) return;
      if (presentationStatus === "paused") {
        setRecovery(recoveryNotice("paused_pending"));
        return;
      }
      setRecovery(null);
      const nxt = adjacentNavigableIndex(script, liveStep, 1);
      const wrap = nxt === liveStep;
      void publishStep(wrap ? 0 : nxt, wrap);
      return;
    }
    const nxt = adjacentNavigableIndex(script, currentIndex, 1);
    if (nxt <= unlockedStep) goLocal(getPointAt(script, nxt).id, "explore");
  };

  const prev = () => {
    if (presenterPreMeetingReview) {
      const idx = getPointIndex(script, currentPoint.id);
      const p = adjacentNavigableIndex(script, idx, -1);
      setPresenterPreviewPointId(getPointAt(script, p).id);
      return;
    }
    if (isPresenter) {
      void publishStep(adjacentNavigableIndex(script, liveStep, -1));
      return;
    }
    goLocal(
      getPointAt(script, adjacentNavigableIndex(script, currentIndex, -1)).id,
      "explore",
    );
  };

  const logView = useCallback(() => {
    if (isPresenter) return;
    void logMeetingActivity({
      meetingId,
      eventType: "CHART_VIEWED",
      actor: actorRef.current,
      scope: "local",
      payload: {
        chartFocus: c.chartFocus,
        viewerEventId: c.presentationEventId,
        presentationEventTitle: c.t,
        chartKind,
        munFilter,
        step: currentIndex,
        pointId: currentPoint.id,
        alignedWithGlobalPresentation: alignedWithGlobal,
      },
    });
  }, [
    meetingId,
    isPresenter,
    c,
    chartKind,
    munFilter,
    currentIndex,
    currentPoint.id,
    alignedWithGlobal,
  ]);

  useEffect(() => {
    if (!ready) return;
    logView();
  }, [ready, currentPoint.id, chartKind, munFilter, logView]);

  const onChartSelect = (extra: Record<string, unknown>) => {
    void logMeetingActivity({
      meetingId,
      eventType: "CHART_SELECTED",
      actor: isPresenter ? { id: "presenter", name: "Presentador" } : actorRef.current,
      scope: "local",
      payload: {
        chartFocus: c.chartFocus,
        step: currentIndex,
        pointId: currentPoint.id,
        chartKind,
        munFilter,
        ...extra,
      },
    });
  };

  const chartHandlers = {
    munFilter,
    chartKind,
    isPresenter,
    onMunFilterChange: (k: MunFilter) => {
      setMunFilter(k);
      trackAnalytics("filter.changed", {
        chart_id: c.chartFocus,
        action: "munFilter",
        metadata: { munFilter: k, chartFocus: c.chartFocus },
      });
      if (follow && !isPresenter) {
        goLocal(currentPoint.id, "explore");
      }
      void logMeetingActivity({
        meetingId,
        eventType: "CHART_SELECTED",
        actor: actorRef.current,
        scope: "local",
        payload: { filter: k, chartFocus: c.chartFocus },
      });
    },
    onChartKindChange: (k: ChartKind) => {
      setChartKind(k);
      trackAnalytics("chart_type.changed", {
        chart_id: c.chartFocus,
        chart_type: k,
        metadata: { chartKind: k },
      });
      void logMeetingActivity({
        meetingId,
        eventType: "CHART_SELECTED",
        actor: isPresenter
          ? { id: "presenter", name: "Presentador" }
          : actorRef.current,
        scope: "local",
        payload: { chartKind: k, chartFocus: c.chartFocus },
      });
    },
    onSelect: onChartSelect,
    trackAnalytics,
  };

  const submitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = question.trim();
    if (!text) {
      setAskOk("Escribe tu pregunta antes de enviarla.");
      return;
    }
    trackAnalytics("question.asked", {
      chart_id: c.chartFocus,
      metadata: {
        question_length: text.length,
        chartFocus: c.chartFocus,
      },
    });
    await logMeetingActivity({
      meetingId,
      eventType: "QUESTION_ASKED",
      actor: actorRef.current,
      scope: "local",
      payload: {
        text,
        chartFocus: c.chartFocus,
        viewerEventId: c.presentationEventId,
        currentPresentationEventId: CHAPTERS[Math.floor(liveStep / 2) % CHAPTERS.length]
          .presentationEventId,
        pointId: currentPoint.id,
      },
    });

    const res = await fetch(`/api/meeting/${meetingId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        chartFocus: c.chartFocus,
        actorId: actorRef.current.id,
        actorName: actorRef.current.name,
      }),
    });
    const data = await res.json();
    if (data.action) {
      const validated = validateChartAction(data.action);
      if (validated.ok) {
        if (validated.action.scope === "global" && isPresenter) {
          void publishGlobalAction(validated.action);
        } else if (validated.action.scope === "local") {
          const nextView = applyChartActionToGlobalView(
            { munFilter, chartKind },
            validated.action,
          );
          if (nextView.munFilter) setMunFilter(nextView.munFilter);
          if (nextView.chartKind) setChartKind(nextView.chartKind);
        }
      }
    }
    if (data.answer) {
      setAiReply(data.answer);
      setAiReplySeq((n) => n + 1);
      await logMeetingActivity({
        meetingId,
        eventType: "AI_RESPONSE",
        actor: { id: "ai", name: "Asistente IA" },
        scope: "local",
        payload: {
          text: data.answer,
          interpreter: data.interpreter,
          hasChartAction: data.hasChartAction,
          hasMeetingEvent: data.hasMeetingEvent,
        },
      });
    }
    setQuestion("");
    setAskOk("Pregunta enviada. Respuesta del asistente abajo.");
  };

  const voteClarity = async (vote: ClarityVote, sectionIdOverride?: string | null) => {
    const sectionKey =
      sectionIdOverride ??
      clarityAwaitSectionId ??
      livePoint?.sectionId ??
      section?.id ??
      c.chartFocus;
    setClarityVote(vote);
    setClarityPromptDismissed(true);
    try {
      await fetch(`/api/meeting/${meetingId}/clarity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: actorRef.current.id,
          sectionKey,
          vote,
        }),
      });
    } catch {
      /* persist best-effort; the local vote and exploration still proceed */
    }
    return true;
  };

  const exploreAfterClarityVote = useCallback(() => {
    const secId = clarityAwaitSectionId ?? livePoint?.sectionId ?? section?.id;
    if (!secId) return;
    const sheetId = specialPointId(script, secId, "full_sheet");
    if (sheetId) goLocal(sheetId, "explore");
  }, [clarityAwaitSectionId, livePoint?.sectionId, section?.id, script, goLocal]);

  useEffect(() => {
    if (isPresenter) return;
    if (!follow) return;
    if (!liveSheetOrClarity) return;
    setClarityVote(null);
    setClarityPromptDismissed(false);
  }, [follow, livePointId, liveSheetOrClarity, isPresenter]);

  const syncBadge = useMemo(() => {
    if (supabaseLoading) return "Comprobando Supabase…";
    if (supabaseHealth?.ok) return "Supabase conectado · tiempo real";
    if (supabaseHealth?.configured) {
      return `Supabase error: ${supabaseHealth.error ?? "revisa tablas/RLS"}`;
    }
    if (isSupabaseConfigured()) return "Supabase configurado (sin verificar)";
    return "Modo local (sin variables Supabase)";
  }, [supabaseHealth, supabaseLoading]);

  const waitingOnPresenter = !isPresenter && follow;
  const localCanMove = !isPresenter && !follow && currentIndex < unlockedStep;

  const jumpKind = (kind: "full_sheet" | "clarity_check") => {
    if (!section) return;
    const id = specialPointId(script, section.id, kind);
    if (!id) return;
    if (presenterPreMeetingReview) {
      setPresenterPreviewPointId(id);
      return;
    }
    void publishPoint(id);
  };

  const rail = (
    <StoryRail
      script={script}
      livePointId={livePointId}
      currentPointId={currentPoint.id}
      unlockedIndex={
        presenterPreMeetingReview ? script.points.length - 1 : unlockedStep
      }
      isPresenter={isPresenter}
      onSelectPoint={(id) => {
        if (presenterPreMeetingReview) {
          setPresenterPreviewPointId(id);
          return;
        }
        if (isPresenter) void publishPoint(id);
        else goLocal(id, "explore");
      }}
      onGenerateScript={
        presenterToken
          ? () => {
              void fetch(`/api/meeting/${meetingId}/script`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-presenter-token": presenterToken,
                },
                body: JSON.stringify({ action: "generate" }),
              });
            }
          : undefined
      }
    />
  );

  const renderStage = () => {
    if (!isPresenter && !visitorSeesMeeting(sessionPhase)) {
      return <VisitorWaitingView />;
    }
    if (isPresenter && sessionPhase === "preparacion") {
      return (
        <PresenterPreparationView
          fileName={prepFileName}
          busy={prepBusy}
          onFile={setPrepFileName}
          onNext={() => void runSimulatedReportGeneration()}
        />
      );
    }
    if (isPresenter && sessionPhase === "generando_informe") {
      return <PresenterGeneratingView message={genMessage || "Generando informe…"} />;
    }
    if (reviewOpen) {
      return (
        <ConceptReviewView
          sectionLabel={section?.name ?? c.t}
          chapterIndex={chapterIndex}
          onClose={() => setReviewOpen(false)}
        />
      );
    }
    if (currentPoint.kind === "introduction") {
      return <IntroductionView script={script} />;
    }
    if (currentPoint.kind === "closing") {
      return (
        <ClosingView
          script={script}
          isPresenter={isPresenter}
          onDownloadCatch={isPresenter ? onDownloadCatchPdf : undefined}
          onDownloadClient={onDownloadClientPdf}
        />
      );
    }
    if (visitorClarityPrompt) {
      const secId = clarityAwaitSectionId ?? livePoint?.sectionId ?? section?.id;
      const claritySection = secId
        ? script.sections.find((s) => s.id === secId)
        : section;
      const clarityChapterIndex = claritySection?.order ?? chapterIndex;
      return (
        <ClarityStepView
          sectionLabel={claritySection?.name ?? c.t}
          chapterIndex={clarityChapterIndex}
          voted={clarityVote}
          onClear={() => {
            void voteClarity("claro", secId).then(() => exploreAfterClarityVote());
          }}
          onDoubts={() => {
            void voteClarity("duda", secId).then(() => {
              setPrivateAskOpen(true);
              exploreAfterClarityVote();
            });
          }}
          onReview={() => {
            void voteClarity("glosario", secId).then(() => setReviewOpen(true));
          }}
          onExplore={() => {
            void voteClarity("explorar", secId).then(() => exploreAfterClarityVote());
          }}
        />
      );
    }
    const fullSheetPoint =
      currentPoint.kind === "full_sheet"
        ? currentPoint
        : isPresenter && currentPoint.kind === "clarity_check" && currentPoint.sectionId
          ? (() => {
              const sheetId = specialPointId(script, currentPoint.sectionId, "full_sheet");
              return sheetId ? getPointById(script, sheetId) : null;
            })()
          : null;
    if (fullSheetPoint) {
      return (
        <FullSheetView
          point={fullSheetPoint}
          script={script}
          unlockedIndex={unlockedStep}
          isPresenter={isPresenter}
          onOpenItem={(item) => {
            setSheetReturnId(fullSheetPoint.id);
            setPeekPointId(item.pointId);
            setChartHighlight(true);
            window.setTimeout(() => setChartHighlight(false), 1400);
            if (isPresenter) return;
            goLocal(item.pointId, "summary_origin");
          }}
        />
      );
    }

    return (
      <section className={`stage ${chartHighlight ? "stage--peek" : ""}`}>
        <div className="text">
          <p className="chapter">{c.eyebrow}</p>
          <h1 className="headline">{currentPoint.title}</h1>
          <div className="big">{c.big}</div>
          <p className="sub">{currentPoint.narrative || c.sub}</p>
          <div className="stats">
            <div>
              <strong>{c.s1v}</strong>
              <span>{c.s1l}</span>
            </div>
            <div>
              <strong>{c.s2v}</strong>
              <span>{c.s2l}</span>
            </div>
          </div>
        </div>
        <ChapterCharts
          chapter={chapterIndex}
          beat={beat}
          munFilter={munFilter}
          chartKind={chartKind}
          isPresenter={isPresenter}
          onMunFilterChange={chartHandlers.onMunFilterChange}
          onChartKindChange={chartHandlers.onChartKindChange}
          events={{ onSelect: onChartSelect }}
          trackAnalytics={trackAnalytics}
        />
      </section>
    );
  };

  const atLastNavigable =
    adjacentNavigableIndex(script, isPresenter ? liveStep : currentIndex, 1) ===
    (isPresenter ? liveStep : currentIndex);

  const shellClass = `app-shell ${isPresenter ? "presentador" : "cliente"}`;
  const presenterLiveDashboard = isPresenter && presenterDashboardReady(sessionPhase);
  const showRailContent = isPresenter
    ? presenterSeesDashboard(sessionPhase)
    : visitorSeesMeeting(sessionPhase);

  return (
    <TavusCviProvider
      meetingId={meetingId}
      presenterToken={presenterToken}
      canStartTavus={presenterLiveDashboard}
    >
      {isPresenter && <TavusAiEcho answer={aiReply} echoId={aiReplySeq} />}
      <div className={shellClass}>
      <header className="top">
        <div className="brand">
          <Link href="/" aria-label="Inicio">
            <Image src="/favicon.png" alt="Catch Consulting" width={40} height={40} />
          </Link>
          <span className="sep" aria-hidden="true" />
          <span className="edition">
            Monitor de Mercado Laboral · Guanajuato · Ene–Feb 2026
          </span>
        </div>
        <div className="top-right">
          <span className="step-label">
            Paso {currentIndex + 1} de {totalPoints}
          </span>
          {!supabaseLoading && supabaseHealth && !supabaseHealth.ok && (
            <span className="pill pill--warn" title={syncBadge}>Sin sync</span>
          )}
          {isPresenter ? (
            <>
              <button
                type="button"
                className="pill"
                onClick={() => void setPresentationPaused(presentationStatus !== "paused")}
                disabled={presenterPreMeetingReview}
              >
                {presentationStatus === "paused" ? "Reanudar" : "Pausar"}
              </button>
              <span className="pill live-pill">
                <span className="dot" />{" "}
                {presenterPreMeetingReview
                  ? "Previsualización · presentador"
                  : "En vivo · presentador"}
              </span>
            </>
          ) : (
            <button
              type="button"
              className="pill"
              onClick={() => {
                if (follow) goLocal(currentPoint.id, "explore");
                else returnToPresentation();
              }}
              aria-pressed={follow}
            >
              <span
                className="dot"
                style={{ background: follow ? "var(--live)" : "var(--cyan)" }}
              />
              {follow ? "Siguiendo en vivo" : "Explorando"}
            </button>
          )}
        </div>
      </header>

      <div className="body">
        {showLeftRail && (
          <aside className="rail">
            {showRailContent ? (
              rail
            ) : (
              <p className="sub" style={{ padding: "12px 14px", margin: 0 }}>
                {isPresenter
                  ? "El guion aparecerá después de preparar la sesión."
                  : "El guion estará disponible cuando comience la reunión."}
              </p>
            )}
            {showDockVideo && <AvatarDockVideo active {...avatarVideoProps} />}
          </aside>
        )}

        <main className="main">
          {isPresenter && recovery && (
            <div className="banner" style={{ marginBottom: "12px" }}>
              <span>
                <strong>{recovery.title}</strong>
                <span className="muted">
                  {" "}
                  · {recovery.detail} {recovery.actionHint}
                </span>
              </span>
              <span className="banner-actions">
                <button type="button" className="btn-small" onClick={() => setRecovery(null)}>
                  Entendido
                </button>
              </span>
            </div>
          )}

          {isPresenter && groupAwaitingModerator && (
            <div className="banner banner--await" style={{ marginBottom: "12px" }}>
              <span>
                <strong>
                  Sección completada: {globalView.sectionAwaitSectionLabel ?? section?.name}
                </strong>
                <span className="muted">
                  {" "}
                  · La presentación espera su autorización. Atienda preguntas en Participación y
                  pulse «Continuar sección» cuando el grupo esté listo.
                </span>
              </span>
              <span className="banner-actions">
                <button type="button" className="btn-small solid" onClick={() => void continueSection()}>
                  Continuar sección
                </button>
              </span>
            </div>
          )}

          {!isPresenter && groupAwaitingModerator && follow && (
            <div className="banner banner--await" style={{ marginBottom: "12px" }}>
              <span>
                <strong>El grupo espera al moderador</strong>
                <span className="muted">
                  {" "}
                  · Puede indicar si quedó claro o enviar una pregunta privada. La presentación no
                  avanza hasta que el moderador continúe.
                </span>
              </span>
            </div>
          )}

          {presenterPreMeetingReview && (
            <div className="banner" style={{ marginBottom: "12px" }}>
              <span>
                <strong>Informe listo.</strong> Explore el guion a la izquierda: la vista
                previa no se comparte hasta que pulse «Iniciar reunión».
              </span>
              <span className="banner-actions">
                <button type="button" className="btn-small" onClick={onDownloadAvatarScriptPdf}>
                  Descargar guion en PDF
                </button>
                <button
                  type="button"
                  className="btn-small solid"
                  onClick={() => void startMeetingFromReady()}
                >
                  Iniciar reunión
                </button>
              </span>
            </div>
          )}

          {!isPresenter && !showLeftRail && showRailContent && (
            <div className="script-mobile">{rail}</div>
          )}

          {!isPresenter && (
            <div className="banner">
              <span>
                <strong>
                  {reviewOpen
                    ? "Repaso conceptual local"
                    : follow && !peekPointId
                      ? "Sigues al presentador"
                      : exploreMode === "summary_origin" || peekPointId
                        ? "Consulta local desde la hoja completa"
                        : "Exploras por tu cuenta"}
                </strong>
                <span className="muted">
                  {reviewOpen && livePointId !== currentPoint.id
                    ? " · el presentador puede estar en otro punto"
                    : " · el contenido habilitado se actualiza en vivo"}
                </span>
              </span>
              <span className="banner-actions">
                {reviewOpen && (
                  <button type="button" className="btn-small" onClick={() => setReviewOpen(false)}>
                    Cerrar repaso
                  </button>
                )}
                {(exploreMode === "summary_origin" || peekPointId) && sheetReturnId && (
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => {
                      setPeekPointId(null);
                      goLocal(sheetReturnId, "explore");
                    }}
                  >
                    Volver a la hoja completa
                  </button>
                )}
                {!follow && (
                  <button type="button" className="btn-small" onClick={returnToPresentation}>
                    Volver a la presentación
                  </button>
                )}
              </span>
            </div>
          )}

          {renderStage()}

          {isPresenter && (
            <div className={`qpanel ${qOpen ? "" : "hidden"}`}>
              {presenterToken && (
                <PresenterEngagementPanel
                  meetingId={meetingId}
                  presenterToken={presenterToken}
                  active={qOpen}
                />
              )}
              <MeetingAnalyticsPanel meetingId={meetingId} active={qOpen} />
              <h4 className="analytics-subhead">Eventos en vivo</h4>
              <ul className="activity-feed">
                {activity.length === 0 && (
                  <li className="muted">Sin eventos aún. Conecta visitantes con Supabase.</li>
                )}
                {activity.map((row) => (
                  <li key={row.id}>
                    <strong>{row.event_type}</strong> · {row.actor_name ?? "—"}{" "}
                    <span className="muted">{new Date(row.created_at).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="caption">
            <div className="cap-text">
              <small>Avatar Catch narrando</small>
              <p>{currentPoint.narrative || (beat === 0 ? c.capA : c.capB)}</p>
              {!isPresenter && aiReply && <p className="ai-inline">{aiReply}</p>}
            </div>
            <div className="controls">
              {isPresenter && (
                <>
                  <button type="button" className="ghost" onClick={() => setQOpen((o) => !o)}>
                    Participación <span className="badge">{activity.length}</span>
                  </button>
                  {section && (
                    <>
                      {peekPointId && (
                        <button type="button" className="ghost" onClick={() => setPeekPointId(null)}>
                          Volver al índice
                        </button>
                      )}
                      <button type="button" className="ghost" onClick={() => jumpKind("full_sheet")}>
                        Hoja completa
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => jumpKind("clarity_check")}
                      >
                        ¿Quedó claro?
                      </button>
                    </>
                  )}
                </>
              )}
              {(!isPresenter && !follow) || isPresenter ? (
                <button type="button" className="ghost round" onClick={prev} aria-label="Anterior">
                  ←
                </button>
              ) : null}
              <button
                type="button"
                className="solid"
                onClick={next}
                disabled={
                  (isPresenter && groupAwaitingModerator) ||
                  (!isPresenter && (waitingOnPresenter || !localCanMove))
                }
              >
                {presenterPreMeetingReview
                  ? "Siguiente en vista previa"
                  : isPresenter
                  ? groupAwaitingModerator
                    ? "Esperando autorización"
                    : atLastNavigable
                      ? "Reiniciar para todos"
                      : "Siguiente para todos"
                  : waitingOnPresenter
                    ? presentationStatus === "paused"
                      ? "Presentación en pausa"
                      : "Esperando al presentador"
                    : localCanMove
                      ? "Siguiente paso"
                      : "Límite de lo habilitado"}
              </button>
            </div>
          </div>

          {!isPresenter && (
            <>
              <MeetingVisitorTools
                meetingId={meetingId}
                participantId={actorRef.current.id}
                sectionKey={section?.id ?? c.chartFocus}
                sectionLabel={section?.name ?? c.t}
                chartFocus={c.chartFocus}
                participantToken={participantToken}
                showClarityButton={false}
                onAskPrivate={() => setPrivateAskOpen(true)}
                onReviewConcepts={() => setReviewOpen(true)}
                onClarityVote={setClarityVote}
              />
              <PrivateQuestionPanel
                meetingId={meetingId}
                participantId={actorRef.current.id}
                participantToken={participantToken}
                sectionKey={section?.id ?? c.chartFocus}
                sectionLabel={section?.name ?? c.t}
                presentationPointId={currentPoint.id}
                open={privateAskOpen}
                onClose={() => setPrivateAskOpen(false)}
              />
              <form className="ask" onSubmit={submitQuestion} id="session-chat">
                <label htmlFor="q">Pregúntale al asistente sobre lo que estás viendo.</label>
                <div className="ask-row">
                  <input
                    id="q"
                    ref={chatRef}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="¿Qué municipio tiene mayor rotación?"
                  />
                  <button type="submit" className="send">Enviar</button>
                </div>
                <span className="ask-ok">{askOk}</span>
              </form>
            </>
          )}
        </main>
      </div>

      {showFloatingAvatar && (
        <PresenterAvatarWidget mobileMode={isMobile} {...avatarVideoProps} />
      )}
      </div>
    </TavusCviProvider>
  );
}
