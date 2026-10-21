"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { AsyncCatchTeamQuestionModal } from "@/components/catch/AsyncCatchTeamQuestionModal";
import { AsyncExploreHeaderTools } from "@/components/catch/AsyncExploreHeaderTools";
import { ContextualIaAskPopover } from "@/components/catch/ContextualIaAskPopover";
import { AvatarDockVideo } from "@/components/catch/AvatarDockVideo";
import { AsyncExploreLeftRail } from "@/components/catch/AsyncExploreLeftRail";
import { AsyncIaSideRail } from "@/components/catch/AsyncIaSideRail";
import { PresenterAvatarWidget } from "@/components/catch/PresenterAvatarWidget";
import { PresentationFloatingNav } from "@/components/catch/PresentationFloatingNav";
import { SectionContextTicker } from "@/components/catch/SectionContextTicker";
import {
  ClosingView,
  ConceptReviewView,
  IntroductionView,
} from "@/components/catch/SectionStepViews";
import { StoryRail } from "@/components/catch/StoryRail";
import { TavusAiEcho } from "@/components/catch/TavusAiEcho";
import { TavusCviProvider } from "@/components/catch/TavusCviProvider";
import { ChapterCharts } from "@/components/charts/ChapterCharts";
import {
  CHAPTERS,
  type ChartKind,
  type MunFilter,
} from "@/lib/data/guanajuato-2026";
import { downloadClientSessionPdf } from "@/lib/meeting/pdf-export";
import {
  adjacentAsyncExploreIndex,
  asyncExploreNavigablePointCount,
  asyncExploreStepNumber,
  resolveAsyncExplorePointId,
} from "@/lib/async/explore-nav";
import {
  chapterMeta,
  generateSessionScript,
  getPointAt,
  getPointById,
  getPointIndex,
  remapHiddenPoint,
  sectionForPoint,
} from "@/lib/meeting/script";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAsyncContextualIaSelection } from "@/hooks/useAsyncContextualIaSelection";
import { useIaVoiceDictation } from "@/hooks/useIaVoiceDictation";
import { usePresentationArrowKeys } from "@/hooks/usePresentationArrowKeys";
import {
  buildAsyncChartQuestion,
  buildAsyncTextQuestion,
} from "@/lib/async/contextual-ask";
import type { TavusRaiseHandResult } from "@/lib/tavus/raise-hand";

type ChatLine = { role: "user" | "assistant"; text: string };

export function AsyncExploreApp() {
  const script = useMemo(() => generateSessionScript("async-explore"), []);
  const lastIndex = script.points.length - 1;
  const [pointId, setPointId] = useState(() =>
    resolveAsyncExplorePointId(script, script.points[0]?.id ?? "intro"),
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const [catchTeamAskOpen, setCatchTeamAskOpen] = useState(false);
  const [munFilter, setMunFilter] = useState<MunFilter>("total");
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const [sectionNavOpen, setSectionNavOpen] = useState(false);
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<ChatLine[]>([]);
  const [askStatus, setAskStatus] = useState("");
  const [asking, setAsking] = useState(false);
  const [aiReply, setAiReply] = useState("");
  const [aiReplySeq, setAiReplySeq] = useState(-1);
  const [handRaised, setHandRaised] = useState(false);
  const showCompactNav = useMediaQuery("(max-width: 599px)");
  const mainZoneRef = useRef<HTMLElement>(null);

  const onVoiceText = useCallback((text: string) => {
    setQuestion(text);
  }, []);
  const voice = useIaVoiceDictation(onVoiceText);

  const selectPoint = useCallback(
    (id: string) => {
      setPointId(resolveAsyncExplorePointId(script, id));
      setReviewOpen(false);
      setSectionNavOpen(false);
    },
    [script],
  );

  const currentPoint = (() => {
    const remapped = remapHiddenPoint(
      script,
      getPointById(script, pointId) ?? getPointAt(script, 0),
    );
    return (
      getPointById(script, resolveAsyncExplorePointId(script, remapped.id)) ?? remapped
    );
  })();
  const currentIndex = getPointIndex(script, currentPoint.id);
  const section = sectionForPoint(script, currentPoint);
  const chartRef = currentPoint.chartRefs[0];
  const chapterIndex = chartRef?.chapterIndex ?? 0;
  const beat = chartRef?.beat ?? 0;
  const chapter = chapterMeta(chapterIndex) ?? CHAPTERS[0];
  const caption = currentPoint.narrative || (beat === 0 ? chapter.capA : chapter.capB);

  const goIndex = (index: number) => {
    const point = script.points[index];
    if (!point) return;
    setPointId(point.id);
    setReviewOpen(false);
    setSectionNavOpen(false);
  };

  const asyncStepTotal = useMemo(() => asyncExploreNavigablePointCount(script), [script]);
  const asyncStep = useMemo(
    () => asyncExploreStepNumber(script, currentPoint.id),
    [script, currentPoint.id],
  );

  const prev = () => goIndex(adjacentAsyncExploreIndex(script, currentIndex, -1));
  const next = () => goIndex(adjacentAsyncExploreIndex(script, currentIndex, 1));
  const prevDisabled = adjacentAsyncExploreIndex(script, currentIndex, -1) === currentIndex;
  const nextDisabled = adjacentAsyncExploreIndex(script, currentIndex, 1) === currentIndex;

  useEffect(() => {
    const normalized = resolveAsyncExplorePointId(script, pointId);
    if (normalized !== pointId) setPointId(normalized);
  }, [script, pointId]);

  const askContextMeta = useMemo(
    () => ({
      step: asyncStep,
      stepTotal: asyncStepTotal,
      sectionName: section?.name,
      slideTitle: currentPoint.title,
    }),
    [asyncStep, asyncStepTotal, section?.name, currentPoint.title],
  );

  const askIa = useCallback(
    async (text: string, opts?: { showInInput?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed || asking) return;
      if (opts?.showInInput) setQuestion(trimmed);
      setAsking(true);
      setAskStatus("Consultando el informe…");
      setThread((prevLines) => [...prevLines, { role: "user", text: trimmed }]);
      setQuestion("");
      try {
        const res = await fetch("/api/async/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            chartFocus: chapter.chartFocus,
            pointTitle: currentPoint.title,
            narrative: caption,
          }),
        });
        const data = (await res.json()) as {
          answer?: string;
          error?: { message?: string };
        };
        if (!res.ok || !data.answer) {
          const message = data.error?.message || "No se pudo consultar al asistente.";
          setAskStatus(message);
          setThread((prevLines) => [...prevLines, { role: "assistant", text: message }]);
          return;
        }
        setThread((prevLines) => [...prevLines, { role: "assistant", text: data.answer! }]);
        setAiReply(data.answer);
        setAiReplySeq((n) => n + 1);
        setAskStatus("Respuesta lista. El avatar la lee si la sesión Tavus está activa.");
      } catch {
        const message = "Error de conexión al consultar al asistente.";
        setAskStatus(message);
        setThread((prevLines) => [...prevLines, { role: "assistant", text: message }]);
      } finally {
        setAsking(false);
      }
    },
    [asking, chapter.chartFocus, currentPoint.title, caption],
  );

  const submitQuestion = async (e: FormEvent) => {
    e.preventDefault();
    const text = question.trim();
    if (!text) {
      setAskStatus("Escribe tu pregunta antes de enviarla.");
      return;
    }
    await askIa(text);
    setHandRaised(false);
  };

  const onChartAskAbout = useCallback(
    (payload: { category: string; value?: number; chartTitle?: string }) => {
      const q = buildAsyncChartQuestion(askContextMeta, {
        kind: "chart",
        category: payload.category,
        chartTitle: payload.chartTitle,
        value: payload.value != null ? String(payload.value) : undefined,
        contentType: "categoría",
      });
      void askIa(q);
    },
    [askContextMeta, askIa],
  );

  const contextualIa = useAsyncContextualIaSelection({
    zoneRef: mainZoneRef,
    enabled: !reviewOpen && !catchTeamAskOpen && !sectionNavOpen,
    onTextSelected: (selection) => {
      const q = buildAsyncTextQuestion(askContextMeta, { kind: "text", selection });
      void askIa(q);
    },
  });

  const dismissOverlays = useCallback(() => {
    setCatchTeamAskOpen(false);
    setReviewOpen(false);
    setSectionNavOpen(false);
    contextualIa.dismissPopover();
  }, [contextualIa]);

  usePresentationArrowKeys({
    enabled: true,
    nav: { next, prev },
    blocked:
      reviewOpen ||
      catchTeamAskOpen ||
      sectionNavOpen ||
      Boolean(contextualIa.popover),
    onEscape: dismissOverlays,
  });

  const handleRaiseHand = useCallback(
    (result: TavusRaiseHandResult) => {
      setHandRaised(true);
      if (result.tavusActive && result.echoSent) {
        setAskStatus("Frida te escucha. Dicta o escribe tu pregunta.");
      } else if (result.tavusActive) {
        setAskStatus("Se cortó la narración. Dicta o escribe tu pregunta.");
      } else {
        setAskStatus(
          "Pulsa «Iniciar Frida» para interrumpirla en voz. Ya puedes dictar o escribir tu pregunta.",
        );
      }
      if (voice.supported) voice.start();
    },
    [voice],
  );

  let stage: ReactNode;
  if (reviewOpen) {
    stage = (
      <ConceptReviewView
        sectionLabel={section?.name ?? chapter.t}
        chapterIndex={chapterIndex}
        onClose={() => setReviewOpen(false)}
      />
    );
  } else if (currentPoint.kind === "introduction") {
    stage = <IntroductionView script={script} asyncExplore />;
  } else if (currentPoint.kind === "closing") {
    stage = (
      <ClosingView
        script={script}
        isPresenter={false}
        onDownloadClient={() =>
          downloadClientSessionPdf(script, {
            editionLabel: script.title || "Monitor de Mercado Laboral",
            clientLabel: "Exploración asincrónica",
            sectionNames: script.sections.map((s) => s.name),
          })
        }
      />
    );
  } else {
    const sectionChapter =
      section?.order != null ? section.order + 1 : chapterIndex + 1;
    stage = (
      <section className="stage">
        <div className="text async-selectable-copy">
          <p className="chapter">
            Capítulo {sectionChapter}
            {section?.name ? ` · ${section.name}` : ""} · {chapter.eyebrow}
          </p>
          <h1 className="headline">{currentPoint.title}</h1>
          <div className="big">{chapter.big}</div>
          <p className="sub">{currentPoint.narrative || chapter.sub}</p>
          <div className="stats">
            <div>
              <strong>{chapter.s1v}</strong>
              <span>{chapter.s1l}</span>
            </div>
            <div>
              <strong>{chapter.s2v}</strong>
              <span>{chapter.s2l}</span>
            </div>
          </div>
        </div>
        <ChapterCharts
          chapter={chapterIndex}
          beat={beat}
          munFilter={munFilter}
          chartKind={chartKind}
          isPresenter={false}
          onMunFilterChange={setMunFilter}
          onChartKindChange={setChartKind}
          events={{
            onAskAboutCategory: onChartAskAbout,
          }}
        />
      </section>
    );
  }

  const storyRail = (
    <StoryRail
      script={script}
      livePointId=""
      currentPointId={currentPoint.id}
      unlockedIndex={lastIndex}
      isPresenter={false}
      exploreMode
      onSelectPoint={selectPoint}
    />
  );

  const avatarDock = (
    <AvatarDockVideo
      active
      tavusUi="dock"
      showRaiseHand
      raiseHandActive={handRaised}
      onRaiseHand={handleRaiseHand}
      onMicToggle={voice.toggle}
      micListening={voice.listening}
      micSupported={voice.supported}
    />
  );

  const topBar = (
    <header className={`top${showCompactNav ? " top--async-mobile" : ""}`}>
      <div className="cabeza-principal">
        {showCompactNav ? (
          <>
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
            <div className="async-mobile-head-actions">
              <button
                type="button"
                className="btn-small btn-small--head"
                onClick={() => setCatchTeamAskOpen(true)}
              >
                Preguntar
              </button>
              <button
                type="button"
                className="btn-small btn-small--head"
                onClick={() => setReviewOpen(true)}
              >
                Repasar
              </button>
            </div>
          </>
        ) : (
          <div className="brand">
            <Link href="/" aria-label="Inicio">
              <Image src="/favicon.png" alt="Catch Consulting" width={40} height={40} />
            </Link>
            <span className="sep" aria-hidden="true" />
            <span className="edition">
              Monitor de Mercado Laboral · Guanajuato · Ene–Feb 2026
            </span>
          </div>
        )}
      </div>
      {!showCompactNav ? (
        <div className="cabeza-acciones">
          <AsyncExploreHeaderTools
            onAskCatchTeam={() => setCatchTeamAskOpen(true)}
            onReviewConcepts={() => setReviewOpen(true)}
          />
          <span className="pill">
            <span className="dot" style={{ background: "var(--cyan)" }} />
            Modo asincrónico
          </span>
          <span className="step-label">
            Paso {asyncStep} de {asyncStepTotal}
          </span>
        </div>
      ) : null}
    </header>
  );

  const iaChatProps = {
    thread,
    question,
    asking,
    askStatus,
    onQuestionChange: setQuestion,
    onSubmit: submitQuestion,
    voiceSupported: voice.supported,
    voiceListening: voice.listening,
    onVoiceToggle: voice.toggle,
  };

  const desktopIaRail = (
    <AsyncIaSideRail variant="rail" avatarSlot={avatarDock} {...iaChatProps} />
  );

  const mobileIaChat = showCompactNav ? (
    <AsyncIaSideRail variant="inline" {...iaChatProps} />
  ) : null;

  const mobileFloatingAvatar = showCompactNav ? (
    <PresenterAvatarWidget
      mobileMode
      tavusUi="dock"
      showRaiseHand
      raiseHandActive={handRaised}
      onRaiseHand={handleRaiseHand}
      onMicToggle={voice.toggle}
      micListening={voice.listening}
      micSupported={voice.supported}
    />
  ) : null;

  const mainPanel = (
    <main ref={mainZoneRef} className="main catch-rail-scroll catch-rail-scroll--light">
      <SectionContextTicker
        label={
          section
            ? `Capítulo ${(section.order ?? chapterIndex) + 1} · ${section.name}`
            : "Contexto de la sección"
        }
        text={caption}
        className="async-selectable-copy"
      />
      {stage}
    </main>
  );

  const slideNav = (
    <PresentationFloatingNav
      onPrev={prev}
      onNext={next}
      prevDisabled={prevDisabled}
      nextDisabled={nextDisabled}
      elevated
    />
  );

  const mobileDrawer =
    showCompactNav && sectionNavOpen ? (
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
            <span>Recorrido</span>
            <button type="button" className="btn-small" onClick={() => setSectionNavOpen(false)}>
              Cerrar
            </button>
          </div>
          <aside className="rail">
            {storyRail}
          </aside>
        </div>
      </>
    ) : null;

  return (
    <TavusCviProvider canStartTavus detached>
      <TavusAiEcho answer={aiReply} echoId={aiReplySeq} />
      <AsyncCatchTeamQuestionModal
        open={catchTeamAskOpen}
        onClose={() => setCatchTeamAskOpen(false)}
        sectionKey={section?.id ?? chapter.chartFocus}
        sectionLabel={section?.name ?? chapter.t}
        presentationPointId={currentPoint.id}
      />
      {contextualIa.popover ? (
        <ContextualIaAskPopover
          x={contextualIa.popover.x}
          y={contextualIa.popover.y}
          onAsk={contextualIa.confirmAsk}
          onDismiss={contextualIa.dismissPopover}
        />
      ) : null}
      <div
        className={`app-shell cliente app-shell--async${
          showCompactNav ? " app-shell--async-compact" : " app-shell--async-split"
        }${sectionNavOpen ? " menu-secciones-abierto" : ""}${
          !showCompactNav && !leftRailOpen ? " app-shell--async-left-collapsed" : ""
        }`}
      >
        {showCompactNav ? (
          <>
            {topBar}
            <div className="body body--async-compact">
              {mobileDrawer}
              <div className="async-mobile-stage">{mainPanel}</div>
              {mobileIaChat ? (
                <div className="async-mobile-chat-dock">{mobileIaChat}</div>
              ) : null}
            </div>
            {slideNav}
            {mobileFloatingAvatar}
          </>
        ) : (
          <>
            <AsyncExploreLeftRail
              open={leftRailOpen}
              onToggle={() => setLeftRailOpen((open) => !open)}
            >
              {storyRail}
            </AsyncExploreLeftRail>
            <div className="async-workspace">
              {topBar}
              <div className="body body--async-single">
                {mainPanel}
              </div>
              {slideNav}
            </div>
            {desktopIaRail}
          </>
        )}
      </div>
    </TavusCviProvider>
  );
}
