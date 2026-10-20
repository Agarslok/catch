"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvatarDockVideo } from "@/components/catch/AvatarDockVideo";
import { PresentationFloatingNav } from "@/components/catch/PresentationFloatingNav";
import { SectionContextTicker } from "@/components/catch/SectionContextTicker";
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
import { usePresentationArrowKeys } from "@/hooks/usePresentationArrowKeys";
import {
  ClarityStepView,
  ClosingView,
  ConceptReviewView,
  FullSheetView,
  IntroductionView,
  PresentationHandoffBanner,
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
import { excerptText, presentationNavMetadata } from "@/lib/analytics/track-presentation";
import { glossaryTermsForChapter } from "@/lib/data/glossary";
import { MeetingVisitorTools } from "@/components/catch/MeetingVisitorTools";
import { PresenterVisitorRoster } from "@/components/catch/PresenterVisitorRoster";
import type { PresenterPrepFaqItem } from "@/components/catch/PresenterFaqPrepSection";
import {
  PREP_FAQS_POLL_MS,
  normalizePrepFaqs,
  readStoredPrepFaqs,
  writeStoredPrepFaqs,
} from "@/lib/meeting/prep-faqs";
import {
  PresenterRightPanel,
  type PresenterLiveRailTab,
} from "@/components/catch/PresenterRightPanel";
import { ParticipantModeratorAskModal } from "@/components/catch/ParticipantModeratorAskModal";
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
  isPresentationHandoffPoint,
  PRESENTATION_HANDOFF_NARRATIVE,
} from "@/lib/meeting/presentation-handoff";
import {
  recoveryNotice,
  type RecoveryNotice,
} from "@/lib/meeting/presentation-recovery";
import {
  applyPresenterHistoryPop,
  historyStepFromPhase,
  nextHistoryPushes,
  type PresenterHistoryStep,
} from "@/lib/meeting/presenter-session-ui";
import type { PresenterVisualTemplateId } from "@/lib/meeting/presenter-visual-templates";
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
  visitorIdentity?: { id: string; name: string };
  initialParticipantToken?: string;
};

export function LiveMeetingApp({
  meetingId,
  role,
  presenterToken,
  visitorIdentity,
  initialParticipantToken,
}: Props) {
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
  const [moderatorAskFromClarity, setModeratorAskFromClarity] = useState(false);
  const pendingClaritySectionIdRef = useRef<string | null>(null);
  const [participantToken, setParticipantToken] = useState(initialParticipantToken ?? "");
  const [munFilter, setMunFilter] = useState<MunFilter>("total");
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const [question, setQuestion] = useState("");
  const [askOk, setAskOk] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [aiReplySeq, setAiReplySeq] = useState(0);
  const [chatThread, setChatThread] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);
  const [clarityVote, setClarityVote] = useState<ClarityVote | null>(null);
  const [clarityPromptDismissed, setClarityPromptDismissed] = useState(false);
  const [presenterRightTab, setPresenterRightTab] =
    useState<PresenterLiveRailTab>("participantes");
  const [prepFaqs, setPrepFaqs] = useState<PresenterPrepFaqItem[]>(() =>
    readStoredPrepFaqs(meetingId),
  );
  const [prepFaqsHydrated, setPrepFaqsHydrated] = useState(false);
  const [presenterVisualTemplate, setPresenterVisualTemplate] =
    useState<PresenterVisualTemplateId>("mml");
  const prepGenAbortRef = useRef(false);
  const presenterHistStepRef = useRef<PresenterHistoryStep | null>(null);
  const presenterHistApplyingRef = useRef(false);
  const [recovery, setRecovery] = useState<RecoveryNotice | null>(null);
  const [sectionNavOpen, setSectionNavOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 860px)");
  const showLeftRail = !isMobile;
  const showDockVideo = !isMobile;
  const showFloatingAvatar = isMobile;
  const avatarVideoPaused = globalView.avatarVideoPaused ?? false;
  const avatarVideoProps = {
    syncPaused: avatarVideoPaused,
    canControlPause: isPresenter,
    onTogglePause: () => void setAvatarVideoPaused(!avatarVideoPaused),
  };

  useEffect(() => {
    if (!isMobile) setSectionNavOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!sectionNavOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSectionNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sectionNavOpen]);
  const chatRef = useRef<HTMLInputElement>(null);
  const narrationExecRef = useRef<string | null>(null);
  const sectionDedupRef = useRef<string | null>(null);
  const lastContinueAtRef = useRef<number | null>(null);
  const actorRef = useRef(
    isPresenter
      ? { id: "presenter", name: "Presentador" }
      : visitorIdentity ?? { id: "visitor", name: "Visitante" },
  );
  const { track: trackAnalyticsRaw } = useInteractionAnalytics({
    meetingId,
    role,
    participantId: actorRef.current.id,
    participantToken: isPresenter ? undefined : participantToken,
    displayName: isPresenter ? undefined : actorRef.current.name,
    enabled: isPresenter || Boolean(participantToken),
  });
  const analyticsContextRef = useRef({
    sectionName: null as string | null,
    sectionId: null as string | null,
    pointId: "",
  });
  const trackAnalytics = useCallback(
    (
      eventType: Parameters<typeof trackAnalyticsRaw>[0],
      fields: Parameters<typeof trackAnalyticsRaw>[1] = {},
    ) => {
      trackAnalyticsRaw(eventType, {
        ...fields,
        metadata: {
          section_name: analyticsContextRef.current.sectionName,
          section_id: analyticsContextRef.current.sectionId,
          point_id: analyticsContextRef.current.pointId,
          ...(fields.metadata ?? {}),
        },
      });
    },
    [trackAnalyticsRaw],
  );
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
    setChatThread([]);
  }, [meetingId]);

  const loadPrepFaqs = useCallback(async () => {
    try {
      const res = await fetch(`/api/meeting/${meetingId}/prep-faqs`);
      if (!res.ok) return false;
      const data = (await res.json()) as { items?: unknown };
      const items = normalizePrepFaqs(data.items);
      if (isPresenter && items.length === 0) {
        const local = readStoredPrepFaqs(meetingId);
        if (local.length > 0) {
          setPrepFaqs(local);
          return true;
        }
      }
      setPrepFaqs(items);
      writeStoredPrepFaqs(meetingId, items);
      return true;
    } catch {
      return false;
    }
  }, [meetingId, isPresenter]);

  useEffect(() => {
    let cancelled = false;
    setPrepFaqsHydrated(false);
    void (async () => {
      const ok = await loadPrepFaqs();
      if (cancelled) return;
      if (!ok) setPrepFaqs(readStoredPrepFaqs(meetingId));
      setPrepFaqsHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [meetingId, loadPrepFaqs]);

  useEffect(() => {
    if (isPresenter) return;
    const fromSync = normalizePrepFaqs(globalView.prepFaqs);
    if (fromSync.length) {
      setPrepFaqs(fromSync);
      writeStoredPrepFaqs(meetingId, fromSync);
    }
  }, [isPresenter, globalView.prepFaqs, meetingId]);

  useEffect(() => {
    if (isPresenter) return;
    const id = window.setInterval(() => {
      void loadPrepFaqs();
    }, PREP_FAQS_POLL_MS);
    return () => window.clearInterval(id);
  }, [isPresenter, loadPrepFaqs]);

  useEffect(() => {
    if (!isPresenter || !prepFaqsHydrated || !presenterToken) return;
    const timer = window.setTimeout(() => {
      writeStoredPrepFaqs(meetingId, prepFaqs);
      void fetch(`/api/meeting/${meetingId}/prep-faqs`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-presenter-token": presenterToken,
        },
        body: JSON.stringify({ items: prepFaqs }),
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isPresenter, prepFaqsHydrated, presenterToken, meetingId, prepFaqs]);

  useEffect(() => {
    if (isPresenter) return;
    if (initialParticipantToken) {
      setParticipantToken(initialParticipantToken);
      return;
    }
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
  }, [isPresenter, meetingId, initialParticipantToken]);

  useEffect(() => {
    if (isPresenter) setPeekPointId(null);
  }, [livePointId, isPresenter]);

  const inPresenterLoadView =
    isPresenter &&
    (prepBusy || sessionPhase === "preparacion" || sessionPhase === "generando_informe");

  const presenterPreMeetingReview =
    isPresenter && presenterInPreMeetingReview(sessionPhase) && !inPresenterLoadView;

  const presenterRightSessionPhase =
    inPresenterLoadView
      ? sessionPhase === "preparacion" && !prepBusy
        ? "preparacion"
        : "generando_informe"
      : sessionPhase;

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
  analyticsContextRef.current = {
    sectionName: section?.name ?? null,
    sectionId: section?.id ?? null,
    pointId: currentPoint.id,
  };
  const chartRef = currentPoint.chartRefs[0];
  const chapterIndex = chartRef?.chapterIndex ?? 0;
  const beat = chartRef?.beat ?? 0;
  const c = chapterMeta(chapterIndex) ?? CHAPTERS[0];
  const alignedWithGlobal = follow || currentPoint.id === livePointId;
  const livePoint = getPointById(script, livePointId);
  const liveAtHandoff =
    visitorSeesMeeting(sessionPhase) && isPresentationHandoffPoint(livePoint);
  const groupAwaitingModerator = globalView.awaitingModerator === true;
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
    prepGenAbortRef.current = false;
    setPrepBusy(true);
    const messages = [
      "Preparando la información",
      "Organizando las secciones del informe",
      "Preparando el guion del avatar",
    ];
    await publishSessionPhase("generando_informe");
    const t0 = Date.now();
    for (const m of messages) {
      if (prepGenAbortRef.current) {
        setGenMessage("");
        setPrepBusy(false);
        return;
      }
      setGenMessage(m);
      await new Promise((r) => setTimeout(r, 750));
    }
    const rest = 2200 - (Date.now() - t0);
    if (rest > 0) await new Promise((r) => setTimeout(r, rest));
    if (prepGenAbortRef.current) {
      setGenMessage("");
      setPrepBusy(false);
      return;
    }
    setGenMessage("");
    await publishSessionPhase("revision_previa");
    setPrepBusy(false);
  }, [isPresenter, prepBusy, publishSessionPhase, sessionPhase]);

  useEffect(() => {
    if (!isPresenter || typeof window === "undefined") return;
    const KEY = "catchPresenterPrep";
    const desired = historyStepFromPhase(sessionPhase, { generating: prepBusy });
    if (presenterHistApplyingRef.current) {
      if (desired === presenterHistStepRef.current) presenterHistApplyingRef.current = false;
      else return;
    }
    const plan = nextHistoryPushes(presenterHistStepRef.current, desired);
    const write = (step: PresenterHistoryStep, mode: "replace" | "push") => {
      const prev = (window.history.state as Record<string, unknown> | null) ?? {};
      const next = { ...prev, [KEY]: step };
      if (mode === "replace") window.history.replaceState(next, "");
      else window.history.pushState(next, "");
      presenterHistStepRef.current = step;
    };
    if (plan.replaceBase) write(plan.replaceBase, "replace");
    for (const step of plan.push) write(step, "push");
  }, [isPresenter, prepBusy, sessionPhase]);

  useEffect(() => {
    if (!isPresenter) return;
    const KEY = "catchPresenterPrep";
    const onPop = (e: PopStateEvent) => {
      const popped = (e.state as Record<string, unknown> | null)?.[KEY];
      const result = applyPresenterHistoryPop(popped, sessionPhase);
      if (!result.applied) return;
      presenterHistApplyingRef.current = true;
      presenterHistStepRef.current =
        popped === "carga" || popped === "revision" || popped === "en_vivo"
          ? popped
          : "carga";
      if (result.abortGeneration) {
        prepGenAbortRef.current = true;
        setPrepBusy(false);
        setGenMessage("");
      }
      if (result.phase !== sessionPhase) void publishSessionPhase(result.phase);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isPresenter, publishSessionPhase, sessionPhase]);


  const startMeetingFromReady = useCallback(async () => {
    if (!presenterInPreMeetingReview(sessionPhase) || !isPresenter) return;
    await publishSessionPhase("reunion_activa");
    await publishStep(liveStep);
  }, [isPresenter, liveStep, publishSessionPhase, publishStep, sessionPhase]);

  const atClosingStep = currentPoint.kind === "closing";

  useEffect(() => {
    if (!isPresenter || !atClosingStep) return;
    if (sessionPhase !== "cierre") void publishSessionPhase("cierre");
  }, [isPresenter, atClosingStep, sessionPhase, publishSessionPhase]);

  const onDownloadAvatarScriptPdf = useCallback(() => {
    downloadAvatarScriptPdf(script, pdfMeta);
  }, [script, pdfMeta]);

  const returnToPresentation = useCallback(
    (userInitiated = true) => {
      void refreshGlobalState().then((row) => {
        const pointId = row?.current_point_id ?? livePointId;
        setFollow(true);
        setOwnPointId(pointId);
        setExploreMode("follow");
        setSheetReturnId(null);
        setPeekPointId(null);
        setReviewOpen(false);
        if (userInitiated) {
          trackAnalytics("explore.returned_to_presentation", {
            chart_id: c.chartFocus,
            metadata: { pointId, user_initiated: true },
          });
        }
      });
    },
    [livePointId, refreshGlobalState, trackAnalytics, c.chartFocus],
  );

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
      returnToPresentation(false);
    }
    prevLiveSectionOrderRef.current = liveSectionOrder;
  }, [liveSectionOrder, isPresenter, returnToPresentation]);

  const trackVisitorNavigation = useCallback(
    (
      eventType:
        | "presentation.navigated_forward"
        | "presentation.navigated_back"
        | "presentation.section_selected",
      fromPointId: string,
      toPointId: string,
      extra?: Record<string, unknown>,
    ) => {
      if (isPresenter) return;
      const fromIdx = getPointIndex(script, fromPointId);
      const toIdx = getPointIndex(script, toPointId);
      const toPoint = getPointById(script, toPointId);
      const sec = toPoint ? sectionForPoint(script, toPoint) : undefined;
      trackAnalytics(eventType, {
        chart_id: c.chartFocus,
        metadata: {
          ...presentationNavMetadata({
            fromPointId,
            toPointId,
            fromIndex: fromIdx,
            toIndex: toIdx,
            sectionId: sec?.id ?? null,
            sectionName: sec?.name ?? null,
            follow: false,
          }),
          ...extra,
        },
      });
    },
    [isPresenter, script, trackAnalytics, c.chartFocus],
  );

  const goLocal = useCallback(
    (pointId: string, mode: LocalExploreMode, nav?: "forward" | "back" | "section") => {
      const idx = getPointIndex(script, pointId);
      if (idx < 0 || idx > unlockedStep) return;
      const fromId = currentPoint.id;
      setFollow(false);
      setOwnPointId(pointId);
      setExploreMode(mode);
      if (mode !== "summary_origin") setSheetReturnId(null);
      trackAnalytics("explore.started", {
        chart_id: c.chartFocus,
        metadata: { pointId, mode, from_point_id: fromId },
      });
      if (nav === "forward") trackVisitorNavigation("presentation.navigated_forward", fromId, pointId);
      else if (nav === "back") trackVisitorNavigation("presentation.navigated_back", fromId, pointId);
      else if (nav === "section")
        trackVisitorNavigation("presentation.section_selected", fromId, pointId);
    },
    [script, unlockedStep, trackAnalytics, c.chartFocus, currentPoint.id, trackVisitorNavigation],
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
    if (nxt <= unlockedStep) goLocal(getPointAt(script, nxt).id, "explore", "forward");
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
      "back",
    );
  };

  const presentationKeyboardNavActive =
    (isPresenter &&
      (presenterPreMeetingReview || presenterDashboardReady(sessionPhase))) ||
    (!isPresenter && visitorSeesMeeting(sessionPhase));

  const dismissPresentationOverlays = useCallback(() => {
    setPrivateAskOpen(false);
    setReviewOpen(false);
    setSectionNavOpen(false);
  }, []);

  usePresentationArrowKeys({
    enabled: presentationKeyboardNavActive,
    nav: { next, prev },
    blocked: privateAskOpen || reviewOpen || sectionNavOpen,
    onEscape: dismissPresentationOverlays,
  });

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
    if (!isPresenter) {
      trackAnalytics("element.clicked", {
        chart_id: c.chartFocus,
        element_id: typeof extra.category === "string" ? extra.category : undefined,
        element_label: typeof extra.label === "string" ? extra.label : undefined,
        metadata: extra,
      });
    }
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
        question_text: excerptText(text),
        chartFocus: c.chartFocus,
        point_id: currentPoint.id,
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
    setChatThread((prev) => [
      ...prev,
      { role: "user", text },
      ...(data.answer
        ? [{ role: "assistant" as const, text: String(data.answer) }]
        : []),
    ]);
    if (data.answer) {
      setAiReply(data.answer);
      setAiReplySeq((n) => n + 1);
      trackAnalytics("question.answered", {
        chart_id: c.chartFocus,
        metadata: {
          answer_text: excerptText(String(data.answer)),
          point_id: currentPoint.id,
          has_chart_action: Boolean(data.action),
        },
      });
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
          setSectionNavOpen(false);
          return;
        }
        if (isPresenter) void publishPoint(id);
        else if (!follow) goLocal(id, "explore", "section");
        setSectionNavOpen(false);
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
    if (isPresenter && (sessionPhase === "generando_informe" || prepBusy)) {
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
        <>
          <ClosingView
            script={script}
            isPresenter={isPresenter}
            onDownloadCatch={isPresenter ? onDownloadCatchPdf : undefined}
            onDownloadClient={onDownloadClientPdf}
          />
          {isPresenter && presenterToken ? (
            <PresenterVisitorRoster
              meetingId={meetingId}
              presenterToken={presenterToken}
              active={true}
              variant="closing"
              showParticipationHistory={true}
            />
          ) : null}
        </>
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
            pendingClaritySectionIdRef.current = secId ?? null;
            setModeratorAskFromClarity(true);
            setPrivateAskOpen(true);
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

  const slideNavIndex = isPresenter
    ? presenterPreMeetingReview
      ? getPointIndex(script, currentPoint.id)
      : liveStep
    : currentIndex;
  const slideNavPrevDisabled =
    adjacentNavigableIndex(script, slideNavIndex, -1) === slideNavIndex ||
    (!isPresenter && waitingOnPresenter);
  const slideNavNextDisabled =
    (isPresenter && groupAwaitingModerator) ||
    (!isPresenter && (waitingOnPresenter || !localCanMove));
  const avatarSlideNav =
    presentationKeyboardNavActive && !reviewOpen ? (
      <PresentationFloatingNav
        onPrev={prev}
        onNext={next}
        prevDisabled={slideNavPrevDisabled}
        nextDisabled={slideNavNextDisabled}
      />
    ) : null;
  const avatarCaptionText =
    liveAtHandoff && (follow || isPresenter)
      ? PRESENTATION_HANDOFF_NARRATIVE
      : currentPoint.narrative || (beat === 0 ? c.capA : c.capB);

  const visitorContextLabel =
    liveAtHandoff && currentPoint.kind !== "closing"
      ? "Espacio de preguntas"
      : "Contexto de la sección";

  const presenterModeratorNotesText = (() => {
    if (currentPoint.kind === "closing") {
      return `${PRESENTATION_HANDOFF_NARRATIVE} Use la pestaña «Preguntas» para la conversación con la sala.`;
    }
    if (currentPoint.kind === "full_sheet" || currentPoint.kind === "clarity_check") {
      return "Al mostrar la hoja, el cliente ve los gráficos en miniatura y se abre la ventana «¿Quedó claro?» (si aún no respondió).";
    }
    if (currentPoint.kind === "introduction") {
      return "Presente la agenda y explique que las preguntas son anónimas y se responden al final.";
    }
    const base = currentPoint.narrative || (beat === 0 ? c.capA : c.capB);
    const terms = glossaryTermsForChapter(c.chartFocus);
    const gloss = terms.length
      ? ` Términos que conviene aclarar: ${terms.join(", ")}.`
      : "";
    return `${base}${gloss}`;
  })();

  const shellClass = `app-shell ${isPresenter ? "presentador" : "cliente"}`;
  const presenterLiveDashboard = isPresenter && presenterDashboardReady(sessionPhase);
  const showRailContent = isPresenter
    ? presenterSeesDashboard(sessionPhase) && !inPresenterLoadView
    : visitorSeesMeeting(sessionPhase);
  const showIaChat =
    (!isPresenter && visitorSeesMeeting(sessionPhase)) ||
    (isPresenter &&
      presenterLiveDashboard &&
      !presenterPreMeetingReview &&
      !inPresenterLoadView);
  const hideNarrationRecoveryBanner =
    recovery &&
    (recovery.kind === "avatar_inactive" ||
      recovery.kind === "narration_unconfirmed" ||
      recovery.kind === "stale_narration_end");

  return (
    <TavusCviProvider
      meetingId={meetingId}
      presenterToken={presenterToken}
      canStartTavus={presenterLiveDashboard}
    >
      {isPresenter && <TavusAiEcho answer={aiReply} echoId={aiReplySeq} />}
      <div className={`${shellClass}${sectionNavOpen ? " menu-secciones-abierto" : ""}`}>
      <header className="top">
        <div className="cabeza-principal">
          {isMobile ? (
            <button
              type="button"
              className="btn-menu"
              aria-expanded={sectionNavOpen}
              aria-controls="nav-secciones"
              aria-label="Menú de secciones"
              onClick={() => setSectionNavOpen((open) => !open)}
            >
              <span className="btn-menu-ico" aria-hidden="true" />
            </button>
          ) : null}
          <div className="brand">
            <Link href="/" aria-label="Inicio">
              <Image src="/favicon.png" alt="Catch Consulting" width={40} height={40} />
            </Link>
            <span className="sep" aria-hidden="true" />
            <span className="edition">
              Monitor de Mercado Laboral · Guanajuato · Ene–Feb 2026
            </span>
          </div>
        </div>
        {!isPresenter ? (
          <div className="cabeza-acciones">
            {!supabaseLoading && supabaseHealth && !supabaseHealth.ok && (
              <span className="pill pill--warn" title={syncBadge}>Sin sync</span>
            )}
            <MeetingVisitorTools
              meetingId={meetingId}
              participantId={actorRef.current.id}
              sectionKey={section?.id ?? c.chartFocus}
              sectionLabel={section?.name ?? c.t}
              chartFocus={c.chartFocus}
              participantToken={participantToken}
              prepFaqs={prepFaqs}
              showClarityButton={false}
              onAskPrivate={() => {
                setModeratorAskFromClarity(false);
                setPrivateAskOpen(true);
                trackAnalytics("question.private_opened", {
                  chart_id: c.chartFocus,
                  metadata: { point_id: currentPoint.id },
                });
              }}
              onReviewConcepts={() => setReviewOpen(true)}
              onClarityVote={setClarityVote}
            />
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
          </div>
        ) : (
          <div className="top-right">
            <span className="step-label">
              Paso {currentIndex + 1} de {totalPoints}
            </span>
            {!supabaseLoading && supabaseHealth && !supabaseHealth.ok && (
              <span className="pill pill--warn" title={syncBadge}>Sin sync</span>
            )}
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
          </div>
        )}
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

        <main className="main catch-rail-scroll catch-rail-scroll--light">
          {isPresenter && recovery && !hideNarrationRecoveryBanner && (
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

          {isMobile && sectionNavOpen ? (
            <>
              <button
                type="button"
                className="nav-velo"
                aria-label="Cerrar menú de secciones"
                onClick={() => setSectionNavOpen(false)}
              />
              <div
                id="nav-secciones"
                className="section-nav-drawer"
                role="dialog"
                aria-label="Secciones"
              >
                <div className="rail-cabeza-movil">
                  <span>Secciones</span>
                  <button type="button" className="btn-small" onClick={() => setSectionNavOpen(false)}>
                    Cerrar
                  </button>
                </div>
                {showRailContent ? (
                  rail
                ) : (
                  <p className="sub" style={{ padding: "12px 14px", margin: 0 }}>
                    {isPresenter
                      ? "El guion aparecerá después de preparar la sesión."
                      : "El guion estará disponible cuando comience la reunión."}
                  </p>
                )}
              </div>
            </>
          ) : null}

          {!isPresenter && visitorSeesMeeting(sessionPhase) && (
            <SectionContextTicker
              label={visitorContextLabel}
              text={avatarCaptionText}
              actions={
                <>
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
                </>
              }
            />
          )}

          {isPresenter &&
            presenterLiveDashboard &&
            !presenterPreMeetingReview &&
            !inPresenterLoadView && (
              <SectionContextTicker
                label="Notas para el moderador"
                text={presenterModeratorNotesText}
              />
            )}

          {liveAtHandoff && currentPoint.kind !== "closing" ? (
            <PresentationHandoffBanner />
          ) : null}

          {renderStage()}

          {(isPresenter || aiReply) && (
          <div className="caption">
            {isPresenter ? (
            <div className="cap-text">
              <small>
                {liveAtHandoff ? "Espacio de preguntas" : "Avatar Catch narrando"}
              </small>
              <p>{avatarCaptionText}</p>
            </div>
            ) : (
              aiReply ? <p className="ai-inline">{aiReply}</p> : null
            )}
            <div className="controls">
              {isPresenter && (
                <>
                  {visitorSeesMeeting(sessionPhase) && (
                    <>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setPresenterRightTab("participantes")}
                      >
                        Participantes
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setPresenterRightTab("preguntas")}
                      >
                        Preguntas
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setPresenterRightTab("intereses")}
                      >
                        Intereses
                        {activity.length > 0 && (
                          <span className="badge">{activity.length}</span>
                        )}
                      </button>
                    </>
                  )}
                  {section && peekPointId && (
                    <button type="button" className="ghost" onClick={() => setPeekPointId(null)}>
                      Volver al índice
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          )}

          {!isPresenter && (
            <ParticipantModeratorAskModal
              meetingId={meetingId}
              participantId={actorRef.current.id}
              participantToken={participantToken}
              sectionKey={section?.id ?? c.chartFocus}
              sectionLabel={section?.name ?? c.t}
              presentationPointId={currentPoint.id}
              open={privateAskOpen}
              fromClarity={moderatorAskFromClarity}
              onQueueSubmitted={
                moderatorAskFromClarity
                  ? () => {
                      void voteClarity("duda", pendingClaritySectionIdRef.current).then(() =>
                        exploreAfterClarityVote(),
                      );
                    }
                  : undefined
              }
              onExploreAfterOral={() => exploreAfterClarityVote()}
              onClose={() => {
                setPrivateAskOpen(false);
                setModeratorAskFromClarity(false);
                pendingClaritySectionIdRef.current = null;
              }}
            />
          )}

          {showIaChat && (
            <form className="ask" onSubmit={submitQuestion} id="session-chat">
              <div className="ask-head">
                <h2 className="headline ask-chat-title">Chatear con la IA</h2>
                {!isPresenter ? (
                  <p className="ask-chart-hint">
                    Toque cualquier barra para ver de dónde sale el dato.
                  </p>
                ) : null}
              </div>
              {chatThread.length > 0 ? (
                <div className="ask-thread" aria-live="polite">
                  {chatThread.map((m, i) => (
                    <div
                      key={`${m.role}-${i}`}
                      className={m.role === "user" ? "ask-thread__user" : "ask-thread__ai"}
                    >
                      {m.text}
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="ask-row">
                <input
                  id="q"
                  className="ask-input--dark"
                  ref={chatRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={
                    isPresenter
                      ? "Ej.: Avanza al siguiente punto · Repite la explicación · Ve a salarios"
                      : "¿Qué significa rotación no controlada?"
                  }
                  aria-label="Chatear con la IA"
                  autoComplete="off"
                />
                <button type="submit" className="send">Enviar</button>
              </div>
              <span className="ask-ok">{askOk}</span>
            </form>
          )}
        </main>

        {isPresenter && (
          <PresenterRightPanel
            meetingId={meetingId}
            presenterToken={presenterToken}
            sessionPhase={presenterRightSessionPhase}
            activity={activity}
            activeTab={presenterRightTab}
            onTabChange={setPresenterRightTab}
            prepFaqs={prepFaqs}
            onPrepFaqsChange={setPrepFaqs}
            visualTemplate={presenterVisualTemplate}
            onVisualTemplateChange={setPresenterVisualTemplate}
            atClosingStep={atClosingStep}
          />
        )}
      </div>

      {showFloatingAvatar && (
        <PresenterAvatarWidget mobileMode={isMobile} {...avatarVideoProps} />
      )}
      {avatarSlideNav}
      </div>
    </TavusCviProvider>
  );
}
