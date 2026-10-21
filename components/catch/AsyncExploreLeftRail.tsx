"use client";

import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function AsyncExploreLeftRail({ open, onToggle, children }: Props) {
  return (
    <>
      <aside
        className={`rail rail--async-nav${open ? "" : " rail--async-collapsed"}`}
        aria-label="Recorrido del informe"
        aria-hidden={!open}
      >
        <div className="rail-async-head">
          <span>Recorrido</span>
          <button
            type="button"
            className="rail-async-toggle"
            onClick={onToggle}
            aria-expanded={open}
            aria-label="Ocultar recorrido"
          >
            ‹
          </button>
        </div>
        {children}
      </aside>
      {!open ? (
        <button
          type="button"
          className="async-left-rail-fab"
          onClick={onToggle}
          aria-expanded={false}
          aria-label="Mostrar recorrido"
        >
          Secciones
        </button>
      ) : null}
    </>
  );
}
