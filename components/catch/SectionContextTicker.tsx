"use client";

import type { ReactNode } from "react";

type Props = {
  label: string;
  text: string;
  actions?: ReactNode;
  className?: string;
};

export function SectionContextTicker({ label, text, actions, className }: Props) {
  const copy = text.trim() || "—";
  const animate = copy.length > 24;

  return (
    <div className={`section-context-ticker${className ? ` ${className}` : ""}`}>
      <div className="section-context-ticker__head">
        <span className="section-context-ticker__label">{label}</span>
        {actions ? <div className="section-context-ticker__actions">{actions}</div> : null}
      </div>
      <div
        className={`section-context-ticker__track${animate ? " section-context-ticker__track--scroll" : ""}`}
        aria-live="polite"
      >
        {animate ? (
          <div className="section-context-ticker__marquee">
            <span>{copy}</span>
            <span aria-hidden="true">{copy}</span>
          </div>
        ) : (
          <p className="section-context-ticker__static">{copy}</p>
        )}
      </div>
    </div>
  );
}
