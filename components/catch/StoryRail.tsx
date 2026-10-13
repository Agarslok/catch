"use client";

import { CHAPTERS } from "@/lib/data/guanajuato-2026";

type Props = {
  unlockedStep: number;
  liveStep: number;
  currentChapter: number;
  onGoToChapter: (chapterIndex: number) => void;
};

export function StoryRail({
  unlockedStep,
  liveStep,
  currentChapter,
  onGoToChapter,
}: Props) {
  const liveCh = Math.floor(liveStep / 2);

  return (
    <div className="story-rail">
      <h2>Recorrido de la historia</h2>
      <div className="rail-list">
        {CHAPTERS.map((c, i) => {
          const visible = i * 2 <= unlockedStep;
          if (!visible) return null;

          const isCurrent = i === currentChapter;
          const isLive = i === liveCh;
          const status = isLive ? "En vivo ahora" : "Ya presentado";
          const dotColor = isLive ? "var(--live)" : "var(--blue)";

          return (
            <button
              key={c.n}
              type="button"
              className={`rail-item${isCurrent ? " current" : ""}`}
              onClick={() => onGoToChapter(i)}
            >
              <span className="rail-num">{c.n}</span>
              <span className="rail-t">
                <strong>{c.t}</strong>
                <span className="rail-desc">{c.sub}</span>
                <span className="rail-status">
                  <i style={{ background: dotColor }} />
                  <em>{status}</em>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
