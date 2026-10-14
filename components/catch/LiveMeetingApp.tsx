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
  TOTAL_STEPS,
  type ChartKind,
  type MunFilter,
} from "@/lib/data/guanajuato-2026";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { useMeetingSync } from "@/hooks/useMeetingSync";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSupabaseHealth } from "@/hooks/useSupabaseHealth";
import { useInteractionAnalytics } from "@/hooks/useInteractionAnalytics";
import { MeetingAnalyticsPanel } from "@/components/catch/MeetingAnalyticsPanel";

type Props = {
  meetingId: string;
  role: "presenter" | "visitor";
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

export function LiveMeetingApp({ meetingId, role }: Props) {
  const isPresenter = role === "presenter";
  const { liveStep, unlockedStep, publishStep, ready } = useMeetingSync(
    meetingId,
    isPresenter,
  );
  const [follow, setFollow] = useState(true);
  const [ownStep, setOwnStep] = useState(0);
  const [munFilter, setMunFilter] = useState<MunFilter>("total");
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const [question, setQuestion] = useState("");
  const [askOk, setAskOk] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [qOpen, setQOpen] = useState(false);
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
  const isMobile = useMediaQuery("(max-width: 860px)");
  const showLeftRail = !isMobile;
  const showDockVideo = !isPresenter && !isMobile;
  const showFloatingAvatar = isPresenter || (isMobile && !isPresenter);

  useEffect(() => {
    if (!isPresenter && follow) setOwnStep(liveStep);
  }, [liveStep, follow, isPresenter]);

  const currentStep = isPresenter ? liveStep : follow ? liveStep : ownStep;
  const chapter = Math.floor(currentStep / 2);
  const beat = currentStep % 2;
  const c = CHAPTERS[chapter];
  const maxStep = isPresenter ? TOTAL_STEPS - 1 : unlockedStep;

  const alignedWithGlobal = follow || currentStep === liveStep;

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
        step: currentStep,
        alignedWithGlobalPresentation: alignedWithGlobal,
      },
    });
  }, [
    meetingId,
    isPresenter,
    c,
    chartKind,
    munFilter,
    currentStep,
    alignedWithGlobal,
  ]);

  useEffect(() => {
    if (!ready) return;
    logView();
  }, [ready, chapter, beat, chartKind, munFilter, logView]);

  const onChartSelect = (extra: Record<string, unknown>) => {
    void logMeetingActivity({
      meetingId,
      eventType: "CHART_SELECTED",
      actor: isPresenter ? { id: "presenter", name: "Presentador" } : actorRef.current,
      scope: "local",
      payload: {
        chartFocus: c.chartFocus,
        step: currentStep,
        chartKind,
        munFilter,
        ...extra,
      },
    });
  };

  const goTo = (step: number) => {
    const s = Math.min(maxStep, Math.max(0, step));
    if (isPresenter) void publishStep(s);
    else {
      setFollow(false);
      setOwnStep(s);
      trackAnalytics("explore.started", {
        chart_id: CHAPTERS[Math.floor(s / 2)].chartFocus,
        metadata: { step: s },
      });
    }
  };

  const next = () => {
    if (isPresenter) {
      const wrap = liveStep + 1 >= TOTAL_STEPS;
      void publishStep(wrap ? 0 : liveStep + 1, wrap);
      return;
    }
    goTo(currentStep + 1);
  };

  const prev = () => goTo(currentStep - 1);

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
        currentPresentationEventId: CHAPTERS[Math.floor(liveStep / 2)].presentationEventId,
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

  const syncBadge = useMemo(() => {
    if (supabaseLoading) return "Comprobando Supabase…";
    if (supabaseHealth?.ok) return "Supabase conectado · tiempo real";
    if (supabaseHealth?.configured) {
      return `Supabase error: ${supabaseHealth.error ?? "revisa tablas/RLS"}`;
    }
    if (isSupabaseConfigured()) return "Supabase configurado (sin verificar)";
    return "Modo local (sin variables Supabase)";
  }, [supabaseHealth, supabaseLoading]);

  const waitPresenter = !isPresenter && currentStep >= unlockedStep;

  return (
    <div className={`app-shell ${isPresenter ? "presentador" : "cliente"}`}>
      <header className="top">
        <div className="brand">
          <Link href="/" className="brand-mark" aria-label="Capital Humano Live">
            <Image src="/favicon.png" alt="" width={44} height={44} />
          </Link>
          <span className="sep" />
          <span className="edition">
            Monitor de Mercado Laboral · Guanajuato · Ene–Feb 2026
          </span>
        </div>
        <div className="top-right">
          <span className="step-label">
            Paso {currentStep + 1} de {TOTAL_STEPS}
          </span>
          {!supabaseLoading && supabaseHealth && !supabaseHealth.ok && (
            <span className="pill pill--warn" title={syncBadge}>
              Sin sync
            </span>
          )}
          {isPresenter ? (
            <span className="pill live-pill">
              <span className="dot" /> En vivo · vista del presentador
            </span>
          ) : (
            <button
              type="button"
              className="pill"
              onClick={() => {
                setFollow((f) => {
                  const next = !f;
                  if (next) {
                    trackAnalytics("explore.returned_to_presentation", {
                      chart_id: c.chartFocus,
                    });
                  } else {
                    trackAnalytics("explore.started", {
                      chart_id: c.chartFocus,
                      metadata: { via: "follow_toggle" },
                    });
                  }
                  return next;
                });
              }}
              aria-pressed={follow}
            >
              <span className="dot" style={{ background: follow ? "var(--live)" : "var(--cyan)" }} />
              {follow ? "Siguiendo en vivo" : "Explorando"}
            </button>
          )}
        </div>
      </header>

      <div className="body">
        {showLeftRail && (
          <aside className="rail">
            <StoryRail
              unlockedStep={unlockedStep}
              liveStep={liveStep}
              currentChapter={chapter}
              onGoToChapter={(i) => goTo(i * 2)}
            />
            {showDockVideo && <AvatarDockVideo active />}
          </aside>
        )}

        <main className="main">
          {!isPresenter && (
            <div className="banner">
              <span>
                <strong>{follow ? "Sigues al presentador" : "Exploras por tu cuenta"}</strong>
                <span className="muted"> · el contenido se actualiza en vivo</span>
              </span>
              {!follow && (
                <button
                  type="button"
                  className="btn-small"
                  onClick={() => {
                    setFollow(true);
                    trackAnalytics("explore.returned_to_presentation", {
                      chart_id: c.chartFocus,
                      metadata: { via: "banner_button" },
                    });
                  }}
                >
                  Volver a la presentación
                </button>
              )}
            </div>
          )}

          {isPresenter && (
            <nav className="segs" aria-label="Capítulos">
              {CHAPTERS.map((ch, i) => (
                <button
                  key={ch.n}
                  type="button"
                  className={`seg ${i === chapter ? "current" : ""}`}
                  onClick={() => goTo(i * 2)}
                >
                  <span className="track">
                    <b
                      style={{
                        width:
                          i < chapter ? "100%" : i === chapter ? (beat ? "100%" : "50%") : "0%",
                      }}
                    />
                  </span>
                  <span>
                    {ch.n} · {ch.t}
                  </span>
                </button>
              ))}
            </nav>
          )}

          <section className="stage">
            <div className="text">
              <p className="chapter">{c.eyebrow}</p>
              <h1 className="headline">{c.headline}</h1>
              <div className="big">{c.big}</div>
              <p className="sub">{c.sub}</p>
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
              chapter={chapter}
              beat={beat}
              munFilter={munFilter}
              chartKind={chartKind}
              isPresenter={isPresenter}
              onMunFilterChange={(k) => {
                setMunFilter(k);
                trackAnalytics("filter.changed", {
                  chart_id: c.chartFocus,
                  action: "munFilter",
                  metadata: { munFilter: k, chartFocus: c.chartFocus },
                });
                if (follow) {
                  setFollow(false);
                  setOwnStep(liveStep);
                  trackAnalytics("explore.started", {
                    chart_id: c.chartFocus,
                    metadata: { reason: "filter_change" },
                  });
                }
                void logMeetingActivity({
                  meetingId,
                  eventType: "CHART_SELECTED",
                  actor: actorRef.current,
                  scope: "local",
                  payload: { filter: k, chartFocus: c.chartFocus },
                });
              }}
              onChartKindChange={(k) => {
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
              }}
              events={{ onSelect: onChartSelect }}
              trackAnalytics={trackAnalytics}
            />
          </section>

          {isPresenter && (
            <div className={`qpanel ${qOpen ? "" : "hidden"}`}>
              <h3>Actividad y analítica</h3>
              <MeetingAnalyticsPanel meetingId={meetingId} active={qOpen} />
              <h4 className="analytics-subhead">Eventos en vivo (legado)</h4>
              <ul className="activity-feed">
                {activity.length === 0 && (
                  <li className="muted">Sin eventos aún. Conecta visitantes con Supabase.</li>
                )}
                {activity.map((row) => (
                  <li key={row.id}>
                    <strong>{row.event_type}</strong> · {row.actor_name ?? "—"}{" "}
                    <span className="muted">
                      {new Date(row.created_at).toLocaleTimeString()}
                    </span>
                    {row.payload && typeof row.payload === "object" && "text" in row.payload && (
                      <div>{String((row.payload as { text?: string }).text)}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="caption">
            <div className="cap-text">
              <small>Avatar Catch narrando</small>
              <p>{beat === 0 ? c.capA : c.capB}</p>
              {!isPresenter && aiReply && <p className="ai-inline">{aiReply}</p>}
            </div>
            <div className="controls">
              {isPresenter && (
                <button type="button" className="ghost" onClick={() => setQOpen((o) => !o)}>
                  Actividad <span className="badge">{activity.length}</span>
                </button>
              )}
              <button type="button" className="ghost round" onClick={prev} aria-label="Anterior">
                ←
              </button>
              <button
                type="button"
                className="solid"
                onClick={next}
                disabled={waitPresenter}
              >
                {isPresenter
                  ? liveStep === TOTAL_STEPS - 1
                    ? "Reiniciar para todos"
                    : "Avanzar para todos"
                  : waitPresenter
                    ? "Esperando al presentador"
                    : "Siguiente paso"}
              </button>
            </div>
          </div>

          {!isPresenter && (
            <form className="ask" onSubmit={submitQuestion}>
              <label htmlFor="q">Pregúntale al asistente sobre lo que estás viendo.</label>
              <div className="ask-row">
                <input
                  id="q"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="¿Qué municipio tiene mayor rotación?"
                />
                <button type="submit" className="send">
                  Enviar
                </button>
              </div>
              <span className="ask-ok">{askOk}</span>
            </form>
          )}
        </main>
      </div>

      {showFloatingAvatar && <PresenterAvatarWidget mobileMode={isMobile} />}
    </div>
  );
}
