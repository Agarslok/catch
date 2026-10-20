"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumberEs } from "@/lib/charts/insights/compute";
import type { PointNarrative } from "@/lib/charts/insights/types";
import { usePrefersReducedMotion } from "@/lib/charts/motion";

const ENTER_MS = 400;
const EXIT_MS = 300;

type Props = {
  narrative: PointNarrative | null;
  contentKey: string | null;
  onClose: () => void;
  onAskIa?: () => void;
};

type PanelPhase = "hidden" | "enter" | "visible" | "exit";

export function ChartDetailPanel({ narrative, contentKey, onClose, onAskIa }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const [displayed, setDisplayed] = useState<PointNarrative | null>(null);
  const [phase, setPhase] = useState<PanelPhase>("hidden");
  const [swapPulse, setSwapPulse] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevKey = useRef<string | null>(null);
  const phaseRef = useRef<PanelPhase>("hidden");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    if (swapTimer.current) clearTimeout(swapTimer.current);

    if (narrative && contentKey) {
      setDisplayed(narrative);
      const currentPhase = phaseRef.current;

      if (currentPhase === "hidden" || currentPhase === "exit") {
        setPhase(reducedMotion ? "visible" : "enter");
        if (!reducedMotion) {
          const t = requestAnimationFrame(() => setPhase("visible"));
          prevKey.current = contentKey;
          return () => cancelAnimationFrame(t);
        }
      } else if (prevKey.current && prevKey.current !== contentKey) {
        setSwapPulse(true);
        swapTimer.current = setTimeout(
          () => setSwapPulse(false),
          reducedMotion ? 0 : 280,
        );
      }
      prevKey.current = contentKey;
      return;
    }

    if (!narrative && displayed && phaseRef.current !== "exit" && phaseRef.current !== "hidden") {
      if (reducedMotion) {
        setDisplayed(null);
        setPhase("hidden");
        prevKey.current = null;
      } else {
        setPhase("exit");
        exitTimer.current = setTimeout(() => {
          setDisplayed(null);
          setPhase("hidden");
          prevKey.current = null;
        }, EXIT_MS);
      }
    }
  }, [narrative, contentKey, reducedMotion, displayed]);

  useEffect(() => {
    if (!displayed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [displayed, onClose]);

  if (!displayed || phase === "hidden") return null;

  const m = displayed.metrics;
  const phaseClass =
    phase === "enter"
      ? "chart-detail--enter"
      : phase === "exit"
        ? "chart-detail--exit"
        : "chart-detail--visible";

  return (
    <aside
      className={`chart-detail ${phaseClass}`}
      role="dialog"
      aria-labelledby="chart-detail-title"
      aria-describedby="chart-detail-conclusion"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={
        reducedMotion
          ? undefined
          : {
              transitionDuration:
                phase === "exit" ? `${EXIT_MS}ms` : `${ENTER_MS}ms`,
            }
      }
    >
      <div className={`chart-detail__body${swapPulse ? " chart-detail__body--swap" : ""}`}>
        <header className="chart-detail__head">
          <h3 id="chart-detail-title">{displayed.detailTitle}</h3>
          <button type="button" className="chart-detail__close" onClick={onClose}>
            Cerrar detalle
          </button>
        </header>

        <p className="chart-detail__value">
          <span className="chart-detail__metric">
            {formatNumberEs(m.value)} <small>{m.unit}</small>
          </span>
        </p>

        <ul className="chart-detail__bullets">
          {m.sharePercent != null && m.shareDenominatorLabel && (
            <li>
              Participación: {formatNumberEs(m.sharePercent, 1)}% del {m.shareDenominatorLabel}
              {m.shareDenominatorLabel === "total de bajas" ? " (100% en la serie)." : "."}
            </li>
          )}
          {m.previousLabel != null && m.previousValue != null && (
            <li>
              Periodo anterior ({m.previousLabel}): {formatNumberEs(m.previousValue)} {m.unit}
              {m.deltaAbsolute != null && (
                <>
                  {" "}
                  · Cambio: {formatNumberEs(m.deltaAbsolute)} {m.unit}
                  {m.deltaPercent != null &&
                    ` (${formatNumberEs(m.deltaPercent, 1)}%)`}
                </>
              )}
            </li>
          )}
          {m.averageValue != null && m.vsAverageDelta != null && (
            <li>
              Promedio de categorías: {formatNumberEs(m.averageValue)} {m.unit} · Diferencia:{" "}
              {formatNumberEs(m.vsAverageDelta)} {m.unit}
            </li>
          )}
          {m.rank != null && m.rankTotal != null && (
            <li>Ranking en esta vista: {m.rank} de {m.rankTotal}</li>
          )}
          {displayed.bullets
            .filter(
              (b) =>
                !b.startsWith("Participación:") &&
                !b.startsWith("Promedio") &&
                !b.startsWith("Posición"),
            )
            .map((b) => (
              <li key={b}>{b}</li>
            ))}
        </ul>

        <p id="chart-detail-conclusion" className="chart-detail__conclusion">
          {displayed.conclusion}
        </p>
        <p className="chart-detail__source">{displayed.sourceNote}</p>
        {onAskIa ? (
          <div className="chart-detail__ask">
            <button type="button" className="solid solid--on-light" onClick={onAskIa}>
              Preguntar a la IA
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
