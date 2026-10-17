"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvatarDockVideo } from "@/components/catch/AvatarDockVideo";
import { PresenterAvatarWidget } from "@/components/catch/PresenterAvatarWidget";
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
} from "@/components/catch/SectionStepViews";
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
import type { LocalExploreMode } from "@/lib/meeting/script-types";
import type { ClarityVote } from "@/lib/meeting/session-types";
import { validateChartAction } from "@/lib/visualization/actions";

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
    publishGlobalAction,
    ready,
  } = useMeetingSync(meetingId, isPresenter, presenterToken);

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
  const [clarityVote, setClarityVote] = useState<ClarityVote | null>(null);
  const [qOpen, setQOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 860px)");
  const showLeftRail = !isMobile || isPresenter;
  const showDockVideo = !isPresenter && !isMobile;
  const showFloatingAvatar = !isPresenter && isMobile;
  const chatRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!follow || isPresenter) return;
    if (globalView.munFilter) setMunFilter(globalView.munFilter);
    if (globalView.chartKind) setChartKind(globalView.chartKind);
  }, [follow, isPresenter, globalView, eventSeq]);

  const currentPointId =
    peekPointId ??
    (isPresenter ? livePointId : follow ? livePointId : ownPointId);
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

  const returnToPresentation = useCallback(() => {
    setFollow(true);
    setOwnPointId(livePointId);
    setExploreMode("follow");
    setSheetReturnId(null);
    setPeekPointId(null);
    setReviewOpen(false);
    trackAnalytics("explore.returned_to_presentation", {
      chart_id: c.chartFocus,
    });
  }, [livePointId, trackAnalytics, c.chartFocus]);

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

  const next = () => {
    if (isPresenter) {
      const nxt = adjacentNavigableIndex(script, liveStep, 1);
      const wrap = nxt === liveStep;
      void publishStep(wrap ? 0 : nxt, wrap);
      return;
    }
    const nxt = adjacentNavigableIndex(script, currentIndex, 1);
    if (nxt <= unlockedStep) goLocal(getPointAt(script, nxt).id, "explore");
  };

  const prev = () => {
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

  const voteClarity = async (vote: ClarityVote) => {
    const sectionKey = section?.id ?? c.chartFocus;
    const res = await fetch(`/api/meeting/${meetingId}/clarity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId: actorRef.current.id,
        sectionKey,
        vote,
      }),
    });
    if (res.ok) setClarityVote(vote);
    return res.ok;
  };

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
    if (id) void publishPoint(id);
  };

  const rail = (
    <StoryRail
      script={script}
      livePointId={livePointId}
      currentPointId={currentPoint.id}
      unlockedIndex={unlockedStep}
      isPresenter={isPresenter}
      onSelectPoint={(id) => {
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
      return <ClosingView script={script} />;
    }
    if (currentPoint.kind === "full_sheet") {
      return (
        <FullSheetView
          point={currentPoint}
          script={script}
          unlockedIndex={unlockedStep}
          isPresenter={isPresenter}
          onOpenItem={(item) => {
            setSheetReturnId(currentPoint.id);
            setPeekPointId(item.pointId);
            setChartHighlight(true);
            window.setTimeout(() => setChartHighlight(false), 1400);
            if (isPresenter) return;
            goLocal(item.pointId, "summary_origin");
          }}
        />
      );
    }
    if (currentPoint.kind === "clarity_check") {
      return (
        <ClarityStepView
          sectionLabel={section?.name ?? c.t}
          chapterIndex={chapterIndex}
          voted={clarityVote}
          onClear={() => {
            void voteClarity("claro");
          }}
          onDoubts={() => {
            void voteClarity("duda");
            setPrivateAskOpen(true);
          }}
          onReview={() => {
            void voteClarity("glosario");
            setReviewOpen(true);
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

  return (
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
              >
                {presentationStatus === "paused" ? "Reanudar" : "Pausar"}
              </button>
              <span className="pill live-pill">
                <span className="dot" /> En vivo · presentador
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
            {rail}
            {showDockVideo && <AvatarDockVideo active />}
          </aside>
        )}

        <main className="main">
          {!isPresenter && !showLeftRail && <div className="script-mobile">{rail}</div>}

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
                disabled={!isPresenter && (waitingOnPresenter || !localCanMove)}
              >
                {isPresenter
                  ? atLastNavigable
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

      {showFloatingAvatar && <PresenterAvatarWidget mobileMode={isMobile} />}
    </div>
  );
}
