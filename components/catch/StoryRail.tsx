"use client";

import { useEffect, useMemo, useState } from "react";
import { ASYNC_EXPLORE_SKIP_KINDS } from "@/lib/async/explore-nav";
import {
  getPointIndex,
  isNavigableKind,
  visitorVisibleSections,
} from "@/lib/meeting/script";
import type { ScriptPoint, ScriptPointKind, SessionScript } from "@/lib/meeting/script-types";

type Props = {
  script: SessionScript;
  livePointId: string;
  currentPointId: string;
  unlockedIndex: number;
  isPresenter: boolean;
  onSelectPoint: (pointId: string) => void;
  onGenerateScript?: () => void;
  /** Exploración libre (modo asincrónico): sin «en vivo». */
  exploreMode?: boolean;
};

const KIND_LABEL: Record<ScriptPointKind, string> = {
  introduction: "Inicio",
  chart: "Gráfico",
  full_sheet: "Hoja",
  section_summary: "Resumen",
  clarity_check: "Claridad",
  doubt_resolution: "Dudas",
  closing: "Cierre",
};

function glyph(kind: ScriptPointKind) {
  if (kind === "full_sheet") return "▦";
  if (kind === "section_summary") return "▣";
  if (kind === "clarity_check") return "?";
  if (kind === "doubt_resolution") return "…";
  if (kind === "closing" || kind === "introduction") return "•";
  return "";
}

export function StoryRail({
  script,
  livePointId,
  currentPointId,
  unlockedIndex,
  isPresenter,
  onSelectPoint,
  onGenerateScript,
  exploreMode = false,
}: Props) {
  const liveIndex = getPointIndex(script, livePointId);
  const currentIndex = getPointIndex(script, currentPointId);
  const current = script.points.find((p) => p.id === currentPointId);

  const sections = isPresenter
    ? script.sections
    : visitorVisibleSections(script, unlockedIndex);

  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!current?.sectionId) return;
    setOpen((prev) => ({ ...prev, [current.sectionId!]: true }));
  }, [current?.sectionId]);

  const standalone = useMemo(
    () => script.points.filter((p) => !p.sectionId),
    [script.points],
  );

  const visibleStandalone = isPresenter
    ? standalone
    : standalone.filter((p) => getPointIndex(script, p.id) <= unlockedIndex);

  const renderPoint = (p: ScriptPoint, nested = false) => {
    const idx = getPointIndex(script, p.id);
    const unlocked = idx <= unlockedIndex;
    const isLive = !exploreMode && p.id === livePointId;
    const isCurrent = p.id === currentPointId;
    const done = exploreMode
      ? idx < currentIndex
      : unlocked && idx < liveIndex && p.id !== livePointId;
    const upcoming = isPresenter && !unlocked;

    if (!isNavigableKind(p.kind)) return null;
    if (exploreMode && ASYNC_EXPLORE_SKIP_KINDS.includes(p.kind)) return null;
    if (!isPresenter && !unlocked) return null;

    const clickable = isPresenter || unlocked;
    const status = exploreMode
      ? isCurrent
        ? "Viendo ahora"
        : done
          ? "Visitado"
          : "Habilitado"
      : isLive
        ? "En vivo ahora"
        : done
          ? "Ya presentado"
          : upcoming
            ? "Próximo"
            : unlocked
              ? "Habilitado"
              : "Pendiente";

    return (
      <button
        key={p.id}
        type="button"
        className={`rail-item${nested ? " rail-item--nested" : ""}${isCurrent ? " current" : ""}${isLive ? " live" : ""}${p.kind !== "chart" ? ` rail-kind-${p.kind}` : ""}`}
        disabled={!clickable}
        aria-current={isCurrent ? true : undefined}
        onClick={() => {
          if (!clickable) return;
          onSelectPoint(p.id);
        }}
      >
        <span className="rail-num">{glyph(p.kind) || String(idx + 1)}</span>
        <span className="rail-t">
          <strong>{p.title}</strong>
          <span className="rail-desc">{KIND_LABEL[p.kind]}</span>
          <span className="rail-status">
            <i
              style={{
                background: isLive
                  ? "var(--live)"
                  : done
                    ? "var(--blue)"
                    : "var(--line)",
              }}
            />
            <em>{status}</em>
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="story-rail catch-rail-scroll">
      <div className="rail-brand" aria-label="Catch Consulting">
        <span className="rail-brand__name">Catch</span>
        <span className="rail-brand__tag">CONSULTING</span>
      </div>
      <h2>Recorrido de la historia</h2>
      <div className="rail-list">
        {visibleStandalone
          .filter((p) => p.kind === "introduction")
          .map((p) => renderPoint(p))}

        {sections.map((sec) => {
          const expanded = open[sec.id] ?? sec.id === current?.sectionId;
          const secPoints = sec.pointIds
            .map((id) => script.points.find((p) => p.id === id))
            .filter((p): p is ScriptPoint => {
              if (!p) return false;
              return isNavigableKind(p.kind);
            });
          const firstIdx = getPointIndex(script, sec.pointIds[0] ?? "");
          const lastIdx = getPointIndex(script, sec.pointIds[sec.pointIds.length - 1] ?? "");
          const isCurrentSec = current?.sectionId === sec.id;
          const completed =
            lastIdx >= 0 && lastIdx < liveIndex && !isCurrentSec && lastIdx <= unlockedIndex;

          return (
            <div key={sec.id} className={`rail-section${isCurrentSec ? " current-sec" : ""}`}>
              <button
                type="button"
                className={`rail-section-head${isCurrentSec ? " current" : ""}`}
                onClick={() =>
                  setOpen((prev) => ({ ...prev, [sec.id]: !expanded }))
                }
              >
                <span className="rail-section-name">{sec.name}</span>
                <span className="rail-section-meta">
                  {completed ? "Completada" : isCurrentSec ? "Actual" : firstIdx <= unlockedIndex ? "Habilitada" : "Próxima"}
                </span>
              </button>
              {expanded && secPoints.map((p) => renderPoint(p, true))}
            </div>
          );
        })}

        {visibleStandalone
          .filter((p) => p.kind === "closing")
          .map((p) => renderPoint(p))}
      </div>
      {isPresenter && onGenerateScript && livePointId === "intro" && (
        <button type="button" className="btn-small" onClick={onGenerateScript}>
          Generar guion con datos autorizados
        </button>
      )}
    </div>
  );
}
